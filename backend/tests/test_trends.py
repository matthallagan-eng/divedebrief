from pathlib import Path

import pytest

from app.routers.trends import HEADLINE_DIVES, headline
from app.scoring import Profile, ScoringSettings
from app.scoring.ascent_control import score_ascent

from test_sites import _located_dive, _upload

REAL_FIT = sorted((Path(__file__).parent / "fixtures" / "fit" / "real").glob("*.fit"))


def test_ascent_metrics_are_median_and_fastest_ascent_rate():
    # 20 m to 10 m at 12 m/min, then 10 m to 0 m at 6 m/min, held at depth between
    times = [0, 60, 110, 200, 300, 400]
    depths = [20, 20, 10, 10, 0, 0]
    result = score_ascent(Profile.from_samples(times, depths, 10), ScoringSettings())
    assert result.metrics["max_ascent_m_per_min"] == pytest.approx(12, abs=0.5)
    assert result.metrics["median_ascent_m_per_min"] == pytest.approx(6, abs=0.5)


def test_headline_compares_the_last_ten_scored_dives_with_the_ten_before():
    newest_first = [90] * HEADLINE_DIVES + [None, None] + [70] * HEADLINE_DIVES + [10]
    h = headline("ascent", newest_first)
    assert (h.recent, h.recent_dives, h.previous, h.previous_dives) == (90, 10, 70, 10)

    few = headline("stop", [80, None, 60])
    assert (few.recent, few.recent_dives, few.previous, few.previous_dives) == (70, 2, None, 0)


def test_trends_for_real_dives(client):
    for path in REAL_FIT:
        _upload(client, path.name, path.read_bytes())
    body = client.get("/trends").json()

    assert body["window"] == HEADLINE_DIVES
    points = body["points"]
    assert len(points) == 3
    assert [p["started_at"] for p in points] == sorted(p["started_at"] for p in points)
    for p in points:
        assert set(p["scores"]) == {"ascent", "stop", "buoyancy", "air"}
        assert 0 < p["median_ascent_m_per_min"] <= p["max_ascent_m_per_min"]
    # The 12:02 dive's fastest ascent, as its ascent score reason gives it
    last = client.get(f"/dives/{points[-1]['id']}").json()
    ascent_reason = next(s["reason"] for s in last["scores"] if s["skill"] == "ascent")
    assert f"{points[-1]['max_ascent_m_per_min']:.0f} m/min" in ascent_reason

    by_skill = {h["skill"]: h for h in body["headlines"]}
    assert set(by_skill) == {"ascent", "stop", "buoyancy", "air", "overall"}
    assert by_skill["ascent"]["recent_dives"] == 3 and by_skill["ascent"]["previous"] is None
    assert by_skill["air"]["recent"] is None  # no tanks entered


def test_trends_filter_by_site(client):
    _upload(client, "a.uddf", _located_dive("2026-05-01T10:00:00", 12.5, -70.0))
    _upload(client, "b.uddf", _located_dive("2026-05-02T10:00:00", 20.0, -80.0))
    _upload(client, "c.uddf", _located_dive("2026-05-03T10:00:00", 12.5, -70.0))
    single = (Path(__file__).parent / "fixtures" / "uddf" / "synthetic" / "single_dive.uddf").read_bytes()
    _upload(client, "single_dive.uddf", single)  # no GPS

    sites = client.get("/sites").json()["sites"]
    pair = next(s for s in sites if len(s["dives"]) == 2)
    assert len(client.get("/trends").json()["points"]) == 4
    at_pair = client.get(f"/trends?site={pair['id']}").json()["points"]
    assert [p["site_id"] for p in at_pair] == [pair["id"]] * 2
    unknown = client.get("/trends?site=unknown").json()["points"]
    assert len(unknown) == 1 and unknown[0]["site_id"] is None
    assert client.get("/trends?site=reef").status_code == 422

    # The logbook shows each dive's site
    dives = client.get("/dives").json()
    assert sum(d["site_id"] == pair["id"] for d in dives) == 2
    assert all(d["site_name"] is None for d in dives)
