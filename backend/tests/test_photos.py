import pytest

from app.config import settings
from app.routers import photos

from conftest import sign_up
from test_api import _upload

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.7\n" + b"\x00" * 64


@pytest.fixture(autouse=True)
def uploads(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    return tmp_path


def _stored(uploads):
    return [p for p in uploads.rglob("*") if p.is_file()]


def _dive(client):
    res = _upload(client)
    assert res.status_code == 200
    return client.get("/dives").json()[0]["id"]


def _add(client, dive_id, content=JPEG, caption=""):
    return client.post(f"/dives/{dive_id}/photos", files={"file": ("photo.jpg", content, "image/jpeg")}, data={"caption": caption})


def test_photos_are_added_captioned_served_and_deleted(client, uploads):
    dive_id = _dive(client)
    res = _add(client, dive_id, caption="  A sunfish near the platform ")
    assert res.status_code == 201
    photo = res.json()
    assert photo["caption"] == "A sunfish near the platform" and photo["dive_id"] == dive_id
    _add(client, dive_id, PNG)
    assert [p["id"] for p in client.get(f"/dives/{dive_id}/photos").json()] == [photo["id"], photo["id"] + 1]

    got = client.get(f"/photos/{photo['id']}/file")
    assert got.content == JPEG and got.headers["content-type"] == "image/jpeg"
    assert "no-store" in got.headers["cache-control"]

    assert client.put(f"/photos/{photo['id']}", json={"caption": "Sunfish"}).json()["caption"] == "Sunfish"
    assert client.delete(f"/photos/{photo['id']}").status_code == 204
    assert client.get(f"/photos/{photo['id']}/file").status_code == 404
    assert [p.suffix for p in _stored(uploads)] == [".png"]


def test_the_first_photo_unlocks_the_lionfish(client):
    dive_id = _dive(client)
    a = {x["key"]: x for x in client.get("/achievements").json()["achievements"]}
    assert not a["lionfish"]["earned_at"] and a["lionfish"]["coming_soon"] is None
    _add(client, dive_id)
    a = {x["key"]: x for x in client.get("/achievements").json()["achievements"]}
    assert a["lionfish"]["earned_dive_id"] == dive_id


def test_only_photos_and_not_too_many(client, monkeypatch):
    dive_id = _dive(client)
    assert _add(client, dive_id, PDF).status_code == 400  # fine for cards, not for dive photos
    assert _add(client, dive_id, b"<svg onload=alert(1)>").status_code == 400
    assert _add(client, dive_id, caption="x" * 201).status_code == 422
    monkeypatch.setattr(photos, "PER_DIVE", 1)
    assert _add(client, dive_id).status_code == 201
    assert _add(client, dive_id).status_code == 400


def test_deleting_a_dive_or_its_upload_removes_the_photo_files(client, uploads):
    dive_id = _dive(client)
    _add(client, dive_id)
    assert client.delete(f"/dives/{dive_id}").status_code == 204
    assert not _stored(uploads)

    dive_id = _dive(client)
    _add(client, dive_id)
    upload_id = client.get("/uploads").json()[0]["id"]
    assert client.delete(f"/uploads/{upload_id}").status_code == 204
    assert not _stored(uploads)


def test_other_divers_photos_are_out_of_reach(client):
    dive_id = _dive(client)
    photo = _add(client, dive_id).json()
    client.headers.update(sign_up(client, "other@example.com"))
    assert client.get(f"/dives/{dive_id}/photos").status_code == 404
    assert _add(client, dive_id).status_code == 404
    assert client.get(f"/photos/{photo['id']}/file").status_code == 404
    assert client.put(f"/photos/{photo['id']}", json={"caption": "mine"}).status_code == 404
    assert client.delete(f"/photos/{photo['id']}").status_code == 404
