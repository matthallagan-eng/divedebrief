from pathlib import Path

import pytest

from app.config import settings

SYNTHETIC = Path(__file__).parent / "fixtures" / "uddf" / "synthetic"

# One 12 m/min ascent from 20 m to 10 m (see shared/ascent-golden.json)
FAST_ASCENT = b"""<uddf><profiledata><repetitiongroup><dive id="fast">
  <informationbeforedive><datetime>2026-05-01T10:00:00Z</datetime></informationbeforedive>
  <samples>
    <waypoint><divetime>0</divetime><depth>20</depth></waypoint>
    <waypoint><divetime>60</divetime><depth>20</depth></waypoint>
    <waypoint><divetime>110</divetime><depth>10</depth></waypoint>
    <waypoint><divetime>200</divetime><depth>10</depth></waypoint>
  </samples>
</dive></repetitiongroup></profiledata></uddf>"""


def _upload(client, name="single_dive.uddf", content=None):
    if content is None:
        content = (SYNTHETIC / name).read_bytes()
    return client.post("/uploads", files={"file": (name, content, "application/xml")})


def test_upload_stores_dive_with_summary_and_samples(client):
    res = _upload(client)
    assert res.status_code == 200
    body = res.json()
    assert body["added"] == 1 and body["skipped"] == 0
    assert isinstance(body["upload_id"], int)

    [dive] = client.get("/dives").json()
    assert dive["upload_id"] == body["upload_id"]
    assert dive["computer_model"] == "Descent Mk2i"
    assert dive["started_at"].startswith("2026-03-14T09:30:00")

    detail = client.get(f"/dives/{dive['id']}").json()
    assert detail["computer_serial"] == "TEST-0001"
    assert len(detail["samples"]) == 7
    assert detail["samples"][2]["depth_m"] == 18.5


def test_reupload_skips_known_dives_without_creating_upload(client):
    _upload(client)
    body = _upload(client).json()
    assert body == {
        "upload_id": None,
        "filename": "single_dive.uddf",
        "added": 0,
        "skipped": 1,
        "warnings": [],
    }
    assert len(client.get("/uploads").json()) == 1


def test_multi_dive_upload_lists_newest_first(client):
    assert _upload(client, "multi_dive.uddf").json()["added"] == 3
    starts = [d["started_at"] for d in client.get("/dives").json()]
    assert len(starts) == 3
    assert starts == sorted(starts, reverse=True)


def test_ascent_violations_are_counted(client):
    _upload(client, "fast.uddf", FAST_ASCENT)
    [dive] = client.get("/dives").json()
    assert dive["ascent_violations"] == 1


@pytest.mark.parametrize(
    "name, content, message",
    [
        ("dive.fit", b"\x0e\x10", ".uddf or .xml"),
        ("bad.uddf", b"<uddf><oops", "Could not parse UDDF"),
    ],
)
def test_upload_rejects_bad_files(client, name, content, message):
    res = _upload(client, name, content)
    assert res.status_code == 400
    assert message in res.json()["detail"]


def test_upload_rejects_oversized_file(client, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_bytes", 100)
    res = _upload(client)
    assert res.status_code == 400
    assert "too large" in res.json()["detail"]


def test_deleting_upload_removes_its_dives(client):
    upload_id = _upload(client, "multi_dive.uddf").json()["upload_id"]
    assert client.delete(f"/uploads/{upload_id}").status_code == 204
    assert client.get("/dives").json() == []
    assert client.delete(f"/uploads/{upload_id}").status_code == 404


def test_delete_dive(client):
    _upload(client)
    [dive] = client.get("/dives").json()
    assert client.delete(f"/dives/{dive['id']}").status_code == 204
    assert client.get(f"/dives/{dive['id']}").status_code == 404
    assert client.delete(f"/dives/{dive['id']}").status_code == 404
