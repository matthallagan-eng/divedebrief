from datetime import date, datetime, timedelta

import pytest

from app.achievements import compute_achievements
from app.certs import CardFacts
from app.files import sniff
from app.config import settings

from conftest import sign_up
from test_achievements import _dive

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.7\n" + b"\x00" * 64
ADDED = datetime(2026, 9, 1, 12)


@pytest.fixture(autouse=True)
def uploads(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    return tmp_path


def _card(level, certified_on=None, days=0):
    return CardFacts(level, certified_on, ADDED + timedelta(days=days))


def test_file_types_come_from_the_bytes_not_the_name():
    assert sniff(JPEG) == ("image/jpeg", ".jpg")
    assert sniff(PNG) == ("image/png", ".png")
    assert sniff(PDF) == ("application/pdf", ".pdf")
    assert sniff(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == ("image/webp", ".webp")
    assert sniff(b"<html><script>") is None


def test_a_higher_card_counts_for_the_ones_below_it():
    p = compute_achievements([], 180, [_card("divemaster")])
    assert p["scuba_diver"].earned and p["blacktip_shark"].earned and p["great_white"].earned
    assert p["submersible"].earned_at == ADDED and p["submersible"].earned_dive_id is None
    assert not p["research_sub"].earned and p["research_sub"].progress == 1


def test_specialties_dont_count_as_core_levels_but_count_towards_three_cards():
    p = compute_achievements([], 180, [_card("nitrox"), _card("deep", days=1), _card("open_water", days=2)])
    assert p["scuba_diver"].earned_at == ADDED + timedelta(days=2)
    assert not p["blacktip_shark"].earned
    assert p["research_sub"].earned_at == ADDED + timedelta(days=2)


def test_hammerheads_need_a_deep_dive_made_after_the_training():
    deep = [_dive(1, max_depth_m=27), _dive(40, max_depth_m=28)]  # 2 Aug and 10 Sep
    assert not compute_achievements(deep, 180, [_card("open_water")])["hammerheads"].earned
    # Trained on 1 September: the August dive past 25 m doesn't count
    p = compute_achievements(deep, 180, [_card("deep", date(2026, 9, 1))])
    assert p["hammerheads"].earned_dive_id == 40
    # An undated Advanced card is taken on trust
    assert compute_achievements(deep, 180, [_card("advanced")])["hammerheads"].earned_dive_id == 1
    # 25 m exactly isn't past it
    assert not compute_achievements([_dive(1, max_depth_m=25)], 180, [_card("advanced")])["hammerheads"].earned


def test_cards_are_added_edited_and_unlock_creatures(client):
    res = client.post("/cards", json={"agency": " PADI ", "level": "open_water", "number": "1234", "certified_on": "2026-07-12"})
    assert res.status_code == 201
    card = res.json()
    assert card["agency"] == "PADI" and card["level_label"] == "Open Water" and card["front"] is None
    a = {x["key"]: x for x in client.get("/achievements").json()["achievements"]}
    assert a["scuba_diver"]["earned_at"] and a["scuba_diver"]["earned_dive_id"] is None
    assert a["scuba_diver"]["coming_soon"] is None

    res = client.put(f"/cards/{card['id']}", json={"agency": "SSI", "level": "advanced", "title": "Advanced Adventurer"})
    assert res.json()["title"] == "Advanced Adventurer" and res.json()["certified_on"] is None
    assert [c["level"] for c in client.get("/cards").json()] == ["advanced"]


@pytest.mark.parametrize("body", [
    {"level": "other"},  # needs a name
    {"level": "master_of_the_sea"},
    {"level": "open_water", "certified_on": (date.today() + timedelta(days=5)).isoformat()},
    {"level": "open_water", "number": "x" * 41},
])
def test_bad_cards_are_rejected(client, body):
    assert client.post("/cards", json=body).status_code == 422


def test_photos_are_stored_replaced_and_removed(client, uploads):
    card = client.post("/cards", json={"level": "rescue"}).json()
    res = client.put(f"/cards/{card['id']}/front", files={"file": ("card.heic", JPEG, "image/heic")})
    assert res.status_code == 200 and res.json()["front"] == "image/jpeg"
    got = client.get(f"/cards/{card['id']}/front")
    assert got.content == JPEG and got.headers["content-type"] == "image/jpeg"
    assert "no-store" in got.headers["cache-control"]

    # Replacing a side removes the old file
    client.put(f"/cards/{card['id']}/front", files={"file": ("card.pdf", PDF, "application/pdf")})
    client.put(f"/cards/{card['id']}/back", files={"file": ("back.png", PNG, "image/png")})
    files = sorted(p.suffix for p in uploads.rglob("*") if p.is_file())
    assert files == [".pdf", ".png"]

    assert client.delete(f"/cards/{card['id']}/back").json()["back"] is None
    assert client.get(f"/cards/{card['id']}/back").status_code == 404
    assert client.delete(f"/cards/{card['id']}").status_code == 204
    assert not [p for p in uploads.rglob("*") if p.is_file()]


def test_photos_must_be_images_or_pdfs_and_not_too_big(client, monkeypatch):
    card = client.post("/cards", json={"level": "open_water"}).json()
    res = client.put(f"/cards/{card['id']}/front", files={"file": ("card.jpg", b"<svg onload=alert(1)>", "image/jpeg")})
    assert res.status_code == 400
    monkeypatch.setattr(settings, "max_upload_bytes", 32)
    assert client.put(f"/cards/{card['id']}/front", files={"file": ("big.jpg", JPEG, "image/jpeg")}).status_code == 400
    assert client.put(f"/cards/{card['id']}/side", files={"file": ("x.jpg", JPEG, "image/jpeg")}).status_code == 422


def test_other_divers_cards_are_out_of_reach(client):
    card = client.post("/cards", json={"level": "open_water"}).json()
    client.put(f"/cards/{card['id']}/front", files={"file": ("card.jpg", JPEG, "image/jpeg")})
    client.headers.update(sign_up(client, "other@example.com"))
    assert client.get("/cards").json() == []
    assert client.get(f"/cards/{card['id']}/front").status_code == 404
    assert client.put(f"/cards/{card['id']}", json={"level": "instructor"}).status_code == 404
    assert client.delete(f"/cards/{card['id']}").status_code == 404
