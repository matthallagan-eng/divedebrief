from datetime import datetime, timedelta

from app.milestones import DiveRecord, compute_milestones

START = datetime(2026, 8, 1, 10)
OVER = [{"start_s": 100, "end_s": 110, "label": "", "severity": "warning"}]


def _dive(n, ascent=80, over=False, stop=80, held=200, excursions=2, buoyancy=70, overall=75, site=1, minutes=40):
    return DiveRecord(
        id=n,
        started_at=START + timedelta(days=n),
        duration_s=minutes * 60,
        site_id=site,
        overall=overall,
        scores={"ascent": ascent, "stop": stop, "buoyancy": buoyancy, "air": None},
        regions={"ascent": OVER if over else [], "stop": [], "buoyancy": []},
        metrics={"stop": {"held_s": held}, "buoyancy": {"excursions": excursions}},
    )


def _by_key(milestones):
    return {m.key: m for m in milestones}


def test_counts_hours_and_sites():
    dives = [_dive(i, site=i % 3 + 1) for i in range(1, 6)]  # 5 dives, 40 min each, sites 1-3
    m = _by_key(compute_milestones(dives, 180))
    assert m["dives_1"].earned_dive_id == 1
    assert m["dives_5"].earned_dive_id == 5
    assert (m["dives_10"].earned_dive_id, m["dives_10"].progress, m["dives_10"].target) == (None, 5, 10)
    # 1 hour is reached during the second dive (80 min)
    assert m["hours_1"].earned_dive_id == 2
    assert m["hours_5"].progress == 200
    assert m["sites_3"].earned_dive_id == 3


def test_first_clean_ascent_and_streak_progress():
    dives = [_dive(1, over=True), _dive(2), _dive(3), _dive(4, over=True), _dive(5), _dive(6)]
    m = _by_key(compute_milestones(dives, 180))
    assert m["clean_ascent"].earned_dive_id == 2
    assert (m["clean_ascent_streak"].earned_dive_id, m["clean_ascent_streak"].progress) == (None, 2)


def test_stop_milestones_skip_dives_too_shallow_for_one():
    # Dive 2 was too shallow for a stop (N/A), so it neither counts nor breaks the streak
    dives = [_dive(1, held=120), _dive(2, stop=None), _dive(3), _dive(4), _dive(5), _dive(6)]
    m = _by_key(compute_milestones(dives, 180))
    assert m["full_stop"].earned_dive_id == 3
    assert m["stop_streak"].earned_dive_id == 6


def test_skipped_stop_breaks_the_streak():
    dives = [_dive(1), _dive(2), _dive(3, stop=0), _dive(4)]
    assert _by_key(compute_milestones(dives, 180))["stop_streak"].progress == 2


def test_score_milestones():
    dives = [_dive(1), _dive(2, excursions=0, buoyancy=91, overall=92)]
    m = _by_key(compute_milestones(dives, 180))
    assert m["steady_bottom"].earned_dive_id == 2
    assert m["buoyancy_90"].earned_dive_id == 2
    assert m["overall_90"].earned_dive_id == 2


def test_order_is_by_date_not_input():
    dives = [_dive(3), _dive(1), _dive(2)]
    assert _by_key(compute_milestones(dives, 180))["dives_1"].earned_dive_id == 1
