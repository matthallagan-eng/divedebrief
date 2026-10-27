from datetime import datetime, timedelta
from pathlib import Path

import pytest

from app.achievements import CREATURES, TIERS, DiveFacts, compute_achievements
from app.config import settings
from app.sun import is_night

START = datetime(2026, 8, 1, 10)
OVER = [{"start_s": 100, "end_s": 110, "label": "", "severity": "warning"}]
FIT = Path(__file__).parent / "fixtures" / "fit" / "real"


def _dive(n, *, over=False, stop=80, held=200, buoyancy=70, overall=75, site=1, minutes=40, **facts):
    return DiveFacts(**{
        "id": n,
        "started_at": START + timedelta(days=n),
        "duration_s": minutes * 60,
        "site_id": site,
        "site_named": False,
        "overall": overall,
        "scores": {"ascent": 80, "stop": stop, "buoyancy": buoyancy, "air": None},
        "regions": {"ascent": OVER if over else [], "stop": [], "buoyancy": []},
        "metrics": {"stop": {"held_s": held}},
        "water_type": None,
        "min_temp_k": None,
        "latitude": 41.4,
        "has_notes": False,
        **facts,
    })


def test_the_catalog_has_57_unique_creatures_in_every_tier():
    keys = [c.key for c in CREATURES]
    assert len(keys) == 57 == len(set(keys))
    assert all(len(k) <= 32 for k in keys)  # fits achievements_seen.key
    assert {c.tier for c in CREATURES} == set(TIERS)
    assert [c.key for c in CREATURES if c.secret] == ["kraken"]


def test_counts_hours_and_sites_unlock_on_the_dive_that_reaches_them():
    dives = [_dive(i, site=i % 3 + 1, minutes=60) for i in range(1, 6)]
    p = compute_achievements(dives, 180)
    assert p["clownfish"].earned_dive_id == 1
    assert p["sergeant_major"].earned_dive_id == 3
    assert p["green_turtle"].earned_dive_id == 5
    assert (p["barracuda"].progress, p["barracuda"].target, p["barracuda"].earned) == (5, 10, False)
    assert p["parrotfish"].earned_dive_id == 5  # 5 hours
    assert p["stingray"].earned_dive_id == 3  # third site
    assert p["goliath_grouper"].earned_dive_id == 1  # a 60-minute dive


def test_streaks_reset_on_a_miss():
    dives = [_dive(1), _dive(2, over=True)] + [_dive(i) for i in range(3, 8)]
    p = compute_achievements(dives, 180)
    assert p["seahorse"].earned_dive_id == 7  # dives 3-7
    assert (p["leafy_seadragon"].progress, p["leafy_seadragon"].earned) == (5, False)


def test_species_are_counted_once_ignoring_case():
    dives = [
        _dive(1, sea_life=["Bluegill", "bass"]),
        _dive(2, sea_life=["bluegill", "Bass"]),
        _dive(3, sea_life=["Crayfish"]),
    ]
    p = compute_achievements(dives, 180)
    assert p["butterflyfish"].earned_dive_id == 3
    assert p["nudibranch"].progress == 3


def test_water_cold_night_and_seasons():
    dives = [
        _dive(1, water_type="fresh", min_temp_k=282.0),  # 8.85 °C
        _dive(2, water_type="salt", night=True),
        _dive(3, started_at=datetime(2027, 1, 5, 10)),
        _dive(4, started_at=datetime(2027, 4, 5, 10)),
        _dive(5, started_at=datetime(2027, 10, 5, 10)),
    ]
    p = compute_achievements(dives, 180)
    assert p["bluegill"].earned_dive_id == 1
    assert p["crayfish"].earned_dive_id == 1 and not p["narwhal"].earned
    assert p["ocean_sunfish"].earned_dive_id == 2
    assert p["mandarinfish"].earned_dive_id == 2
    # Summer (Aug), winter, spring, autumn
    assert p["leatherback"].earned_dive_id == 5


def test_seasons_flip_south_of_the_equator():
    # January in Australia is summer, so these are summer and winter: two seasons
    dives = [_dive(1, latitude=-16.7, started_at=datetime(2027, 1, 5)), _dive(2, latitude=41.4, started_at=datetime(2027, 1, 6))]
    assert compute_achievements(dives, 180)["leatherback"].progress == 2


def test_coming_soon_creatures_cant_be_earned_and_hold_back_the_tier_prizes():
    dives = [_dive(i, buddy="Sam", landmarks=["Old wreck"]) for i in range(1, 30)]
    p = compute_achievements(dives, 180)
    assert not p["scuba_diver"].earned and not p["blacktip_shark"].earned
    assert p["batfish"].earned_dive_id == 1
    assert p["dolphins"].earned_dive_id == 10
    # The blacktip needs a card, so the golden manta waits
    assert not p["golden_manta"].earned and p["golden_manta"].progress < p["golden_manta"].target
    assert not p["kraken"].earned


def test_night_dives_follow_the_sun_at_the_site():
    quarry = (41.37, -83.32)
    assert not is_night(datetime(2026, 8, 9, 12, 2), *quarry)
    assert not is_night(datetime(2026, 8, 9, 20, 15), *quarry)  # sunset is about 8:35 pm
    assert is_night(datetime(2026, 8, 9, 21, 45), *quarry)
    assert is_night(datetime(2026, 1, 9, 18, 30), *quarry)  # winter evenings are dark early
    # Without a position, by the clock alone
    assert is_night(datetime(2026, 8, 9, 22, 0), None, None)


def _upload_fit(client, name):
    content = (FIT / name).read_bytes()
    return client.post("/uploads", files={"file": (name, content, "application/octet-stream")})


def test_api_lists_achievements_and_remembers_seen_reveals(client):
    for name in ("2026-08-08-15-21-24.fit", "2026-08-09-10-05-30.fit", "2026-08-09-12-02-28.fit"):
        assert _upload_fit(client, name).status_code == 200
    body = client.get("/achievements").json()
    assert len(body["achievements"]) == 57 and body["first_reveal"]
    a = {x["key"]: x for x in body["achievements"]}
    assert a["clownfish"]["earned_dive_id"] and a["sergeant_major"]["earned_dive_id"]
    assert a["pufferfish"]["earned_dive_id"]  # two dives on 9 August
    assert a["green_turtle"]["progress"] == 3 and a["green_turtle"]["earned_at"] is None
    assert (a["kraken"]["name"], a["kraken"]["goal"]) == ("???", "A secret. Keep diving.")

    assert client.post("/achievements/seen", json={"keys": ["clownfish", "clownfish", "not_a_creature"]}).status_code == 204
    body = client.get("/achievements").json()
    assert not body["first_reveal"]
    assert [x["key"] for x in body["achievements"] if x["seen"]] == ["clownfish"]


def test_test_mode_reset_is_hidden_unless_enabled(client, monkeypatch):
    client.post("/achievements/seen", json={"keys": ["clownfish"]})
    assert client.post("/achievements/test/reset-seen").status_code == 404
    monkeypatch.setattr(settings, "achievement_test_mode", True)
    assert client.get("/achievements").json()["test_mode"]
    assert client.post("/achievements/test/reset-seen").status_code == 204
    assert client.get("/achievements").json()["first_reveal"]


@pytest.mark.parametrize("keys", [["x"] * 101])
def test_seen_rejects_huge_lists(client, keys):
    assert client.post("/achievements/seen", json={"keys": keys}).status_code == 422
