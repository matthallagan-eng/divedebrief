import re
from pathlib import Path

import pytest

from app.parsing.uddf import parse_uddf
from app.sites import SITE_RADIUS_M, distance_m

from conftest import sign_up

FIXTURES = Path(__file__).parent / "fixtures"
REAL_FIT = sorted((FIXTURES / "fit" / "real").glob("*.fit"))


def _located_dive(when: str, lat: float, lon: float, site_id: str = "s1") -> bytes:
    return f"""<uddf>
  <divesite><site id="{site_id}"><geography>
    <latitude>{lat}</latitude><longitude>{lon}</longitude>
  </geography></site></divesite>
  <profiledata><repetitiongroup><dive id="{when}">
    <informationbeforedive><link ref="{site_id}"/><datetime>{when}</datetime></informationbeforedive>
    <samples>
      <waypoint><divetime>0</divetime><depth>0</depth></waypoint>
      <waypoint><divetime>600</divetime><depth>12</depth></waypoint>
      <waypoint><divetime>1200</divetime><depth>0</depth></waypoint>
    </samples>
  </dive></repetitiongroup></profiledata>
</uddf>""".encode()


def _upload(client, name: str, content: bytes):
    res = client.post("/uploads", files={"file": (name, content, "application/octet-stream")})
    assert res.status_code == 200, res.text
    return res.json()


def test_distance_m():
    assert distance_m(41.37, -83.31, 41.37, -83.31) == 0
    # One degree of latitude is about 111 km
    assert distance_m(0, 0, 1, 0) == pytest.approx(111_195, rel=1e-3)


def test_uddf_dive_takes_its_linked_site_position():
    [dive] = parse_uddf(_located_dive("2026-05-01T10:00:00", 12.5, -70.25)).dives
    assert (dive.latitude, dive.longitude) == (12.5, -70.25)
    assert dive.entry is None and dive.exit is None


def test_real_fit_dives_form_one_site(client):
    for path in REAL_FIT:
        _upload(client, path.name, path.read_bytes())

    body = client.get("/sites").json()
    assert body["unknown"] == []
    [site] = body["sites"]
    assert len(site["dives"]) == 3
    assert site["name"] is None and site["water_type"] is None
    assert site["latitude"] == pytest.approx(41.3707, abs=1e-3)
    assert set(site["average_scores"]) == {"ascent", "stop", "buoyancy", "air"}
    assert site["average_scores"]["air"] is None  # no tanks entered
    # Newest first, with the surface fixes for drawing the dive
    first, last = site["dives"][-1], site["dives"][0]
    assert first["started_at"] < last["started_at"]
    assert first["entry_latitude"] is not None and first["exit_latitude"] is not None
    assert last["entry_latitude"] is None and last["exit_latitude"] is not None


def test_dives_far_apart_get_separate_sites_and_unlocated_ones_are_unknown(client):
    _upload(client, "a.uddf", _located_dive("2026-05-01T10:00:00", 12.5, -70.0))
    # About 110 m north: the same site
    _upload(client, "b.uddf", _located_dive("2026-05-02T10:00:00", 12.501, -70.0))
    # About 330 m north of the first: too far
    _upload(client, "c.uddf", _located_dive("2026-05-03T10:00:00", 12.503, -70.0))
    _upload(client, "single_dive.uddf", (FIXTURES / "uddf" / "synthetic" / "single_dive.uddf").read_bytes())

    body = client.get("/sites").json()
    sizes = sorted(len(s["dives"]) for s in body["sites"])
    assert sizes == [1, 2]
    assert len(body["unknown"]) == 1
    pair = next(s for s in body["sites"] if len(s["dives"]) == 2)
    assert pair["latitude"] == pytest.approx(12.5005)
    assert distance_m(12.5, -70.0, 12.501, -70.0) < SITE_RADIUS_M < distance_m(12.5, -70.0, 12.503, -70.0)


def test_site_keeps_its_name_when_its_dives_are_reuploaded(client):
    first = _upload(client, "a.uddf", _located_dive("2026-05-01T10:00:00", 12.5, -70.0))
    [site] = client.get("/sites").json()["sites"]
    res = client.put(f"/sites/{site['id']}", json={"name": "  Hilma Hooker ", "water_type": "salt"})
    assert res.status_code == 200
    assert (res.json()["name"], res.json()["water_type"]) == ("Hilma Hooker", "salt")

    client.delete(f"/uploads/{first['upload_id']}")
    assert client.get("/sites").json()["sites"] == []  # empty sites are hidden, not deleted
    _upload(client, "a.uddf", _located_dive("2026-05-01T10:00:00", 12.5, -70.0))
    [again] = client.get("/sites").json()["sites"]
    assert (again["id"], again["name"]) == (site["id"], "Hilma Hooker")

    dive = client.get(f"/dives/{again['dives'][0]['id']}").json()
    assert dive["site"]["name"] == "Hilma Hooker"


def test_site_water_type_feeds_air_efficiency(client):
    _upload(client, REAL_FIT[0].name, REAL_FIT[0].read_bytes())
    [site] = client.get("/sites").json()["sites"]
    dive_id = site["dives"][0]["id"]
    client.put(f"/dives/{dive_id}/tank", json={"volume_l": 11.1, "start_bar": 200, "end_bar": 80})

    def sac() -> float:
        air = next(s for s in client.get(f"/dives/{dive_id}").json()["scores"] if s["skill"] == "air")
        return float(re.match(r"([\d.]+) L/min", air["reason"]).group(1))

    fresh = sac()  # from the watch's water setting
    client.put(f"/sites/{site['id']}", json={"name": None, "water_type": "salt"})
    # Salt water is denser, so the same depth is more pressure and less SAC
    assert sac() < fresh


def test_sites_are_per_diver(client, anon_client):
    _upload(client, "a.uddf", _located_dive("2026-05-01T10:00:00", 12.5, -70.0))
    [site] = client.get("/sites").json()["sites"]

    other = sign_up(anon_client, email="other@example.com")
    assert anon_client.get("/sites", headers=other).json() == {"sites": [], "unknown": []}
    res = anon_client.put(f"/sites/{site['id']}", json={"name": "Mine now"}, headers=other)
    assert res.status_code == 404


def test_site_rejects_bad_water_type(client):
    _upload(client, "a.uddf", _located_dive("2026-05-01T10:00:00", 12.5, -70.0))
    [site] = client.get("/sites").json()["sites"]
    assert client.put(f"/sites/{site['id']}", json={"water_type": "brackish"}).status_code == 422
