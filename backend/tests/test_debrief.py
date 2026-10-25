"""The debrief's rules, on the synthetic profiles from test_scoring.py."""
from dataclasses import asdict

from app.debrief import GearView, PreviousDive, ScoreView, build_debrief
from app.scoring import Profile, ScoringSettings, score_dive

DEFAULTS = ScoringSettings()
IMPERIAL = DEFAULTS.model_copy(update={"units": "imperial"})


def _debrief(times, depths, cfg=DEFAULTS, ndl=(), tank=True, gear=None, previous=None):
    results = score_dive(times, depths, cfg)
    scores = {r.skill: ScoreView(r.score, [asdict(g) for g in r.regions], r.metrics) for r in results}
    p = Profile.from_samples(times, depths, cfg.ascent_window_s)
    return build_debrief(p, scores, cfg, list(ndl), tank, gear, previous), scores


def _by_skill(debrief, skill):
    return [i for i in debrief.items if i.skill == skill]


# Ascend at 6 m/min to 5 m, hold 200 s, ascend: a clean dive
CLEAN = ([0, 60.5, 210.5, 410.5, 460.5], [20, 20, 5, 5, 0])


def test_clean_ascent_and_stop_are_praised():
    debrief, _ = _debrief(*CLEAN)
    [ascent] = _by_skill(debrief, "ascent")
    assert (ascent.kind, ascent.title) == ("good", "Slow, controlled ascents")
    [stop] = _by_skill(debrief, "stop")
    assert (stop.kind, stop.title) == ("good", "Solid safety stop")


def test_fast_ascent_points_at_the_moment_and_is_the_focus():
    # Straight up at 12 m/min from 18 m with no stop: ascent and stop both need work
    debrief, scores = _debrief([0, 60.25, 150.25], [18, 18, 0])
    [ascent] = _by_skill(debrief, "ascent")
    assert ascent.kind == "work_on"
    assert ascent.at_s == 63
    assert ascent.detail.startswith("At 1:03 you rose at 12 m/min from 17 m to 0 m")
    # Ascent scored 4 and the skipped stop 0, so the stop is the focus
    assert scores["stop"].score == 0
    assert debrief.focus.title == "Make a safety stop"
    assert debrief.headline == "Plenty to take away. Start with this: make a safety stop."


def test_drifting_stop_gets_breathing_advice():
    # Hold at 3.5 m, then sink to 6.3 m and hold: 2.8 m of drift, past the 1.5 m allowance
    debrief, _ = _debrief([0, 60.5, 230.5, 290.5, 310.5, 380.5, 430.5], [20, 20, 3.5, 3.5, 6.3, 6.3, 0])
    [stop] = _by_skill(debrief, "stop")
    assert stop.title == "Hold a steadier stop"
    assert "left the stop band 1 time." in stop.detail


def test_buoyancy_excursion_says_which_way():
    times = [0, 60.5, 240.5, 243.5, 248.5, 251.5, 660.5, 690.5, 870.5, 900.5]
    depths = [0, 10, 10, 8.5, 8.5, 10, 10, 5, 5, 0]
    debrief, _ = _debrief(times, depths)
    [buoyancy] = [i for i in _by_skill(debrief, "buoyancy") if i.kind == "work_on"]
    assert buoyancy.detail.startswith("At 4:03 you rose about 1.5 m off your level.")


def test_imperial_units_in_the_text():
    debrief, _ = _debrief([0, 60.25, 150.25], [18, 18, 0], IMPERIAL)
    [ascent] = _by_skill(debrief, "ascent")
    assert ascent.detail.startswith("At 1:03 you rose at 39 ft/min from 57 ft to 0 ft, over your 30 ft/min")


def test_depth_limit_and_ndl():
    debrief, _ = _debrief([0, 60, 160, 360, 410], [0, 22, 22, 5, 0], ndl=[3000, 240, 900])
    titles = [i.title for i in debrief.items if i.skill is None]
    assert "Mind your depth limit" in titles
    assert "Keep more no-stop time" in titles


def test_no_tank_suggests_logging_air():
    debrief, _ = _debrief(*CLEAN, tank=False)
    assert any(i.title == "Track your air" for i in debrief.items)


def test_weighting_compared_with_last_dive():
    previous = PreviousDive(scores={"buoyancy": 60}, gear=GearView(weight_kg=8, suit="5mm"))
    times = [0, 60.5, 660.5, 690.5, 870.5, 900.5]
    depths = [0, 10, 10, 5, 5, 0]
    debrief, scores = _debrief(times, depths, gear=GearView(weight_kg=6, suit="5mm"), previous=previous)
    [w] = [i for i in debrief.items if i.title == "Weighting"]
    assert w.detail.startswith(f"You wore 6 kg this dive, 2 kg less than last time, and your buoyancy scored {scores['buoyancy'].score} against 60.")
    assert "may have helped" in w.detail
    # Buoyancy went up by more than 10 too
    assert any(i.title == "Better than last dive" for i in debrief.items)
