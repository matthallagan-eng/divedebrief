"""The debrief's rules, on the synthetic profiles from test_scoring.py."""
from dataclasses import asdict

from app.debrief import GearView, PreviousDive, ScoreView, build_debrief
from app.dive_day import DayPlace
from app.schemas import DebriefItem
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


# --- goal from last dive -------------------------------------------------------

FAST = ([0, 60.25, 150.25], [18, 18, 0])  # straight up at 12 m/min, no stop


def _focus(times, depths):
    return _debrief(times, depths)[0].focus


def test_goal_met_when_the_skill_has_nothing_left_to_work_on():
    # Last dive's focus was its ascent; this dive's ascent was clean
    focus = DebriefItem(kind="work_on", skill="ascent", title="Slow your ascents", detail="")
    previous = PreviousDive(scores={"ascent": 40}, gear=None, focus=focus)
    debrief, scores = _debrief(*CLEAN, previous=previous)
    assert debrief.goal.status == "met"
    assert debrief.goal.title == focus.title
    assert debrief.goal.detail.startswith(f"Nailed it (40 → {scores['ascent'].score}).")


def test_goal_not_yet():
    focus = _focus(*FAST)  # the skipped stop
    previous = PreviousDive(scores={"stop": 0}, gear=None, focus=focus)
    debrief, _ = _debrief(*FAST, previous=previous)
    assert (debrief.goal.skill, debrief.goal.status) == ("stop", "not_yet")


def test_goal_closer_when_the_score_rose():
    focus = _focus(*FAST)
    previous = PreviousDive(scores={"stop": 0}, gear=None, focus=focus)
    # A stop that drifts: still work to do, but scored well above 0
    debrief, _ = _debrief([0, 60.5, 230.5, 290.5, 310.5, 380.5, 430.5], [20, 20, 3.5, 3.5, 6.3, 6.3, 0], previous=previous)
    assert debrief.goal.status == "closer"


def test_no_goal_without_a_previous_focus():
    assert _debrief(*CLEAN)[0].goal is None


def _day(interval_min, previous_max_m=20.0, n=2):
    return DayPlace(n, n, interval_min * 60, 1, previous_max_m)


def _repeat(debrief):
    return [i for i in debrief.items if i.skill is None and ("dive of the day" in i.title or "surface" in i.title)]


def test_short_surface_interval_is_flagged():
    results = score_dive(*CLEAN, DEFAULTS)
    scores = {r.skill: ScoreView(r.score, [asdict(g) for g in r.regions], r.metrics) for r in results}
    p = Profile.from_samples(*CLEAN, DEFAULTS.ascent_window_s)
    debrief = build_debrief(p, scores, DEFAULTS, [], True, None, None, day=_day(35))
    [item] = _repeat(debrief)
    assert (item.kind, item.title) == ("work_on", "Take a longer surface interval")
    assert "second dive of the day began only 35 min after" in item.detail
    # Not a skill, so it never becomes the focus
    assert debrief.focus is None or debrief.focus.skill is not None


def test_a_rested_repeat_dive_is_noted():
    p = Profile.from_samples(*CLEAN, DEFAULTS.ascent_window_s)
    debrief = build_debrief(p, {}, DEFAULTS, [], True, None, None, day=_day(72, n=3))
    [item] = _repeat(debrief)
    assert (item.kind, item.title) == ("info", "Your third dive of the day")
    assert item.detail.startswith("You had 1 h 12 min at the surface first.")


def test_deeper_repeat_dive_suggests_deepest_first():
    p = Profile.from_samples(*CLEAN, DEFAULTS.ascent_window_s)
    titles = lambda day: [i.title for i in build_debrief(p, {}, IMPERIAL, [], True, None, None, day=day).items]
    assert "Deepest dive first" in titles(_day(90, previous_max_m=12.0))
    # Within 2 m of the dive before is not worth a note
    assert "Deepest dive first" not in titles(_day(90, previous_max_m=18.5))
    [deeper] = [i for i in build_debrief(p, {}, IMPERIAL, [], True, None, None, day=_day(90, 12.0)).items
                if i.title == "Deepest dive first"]
    assert "reached 66 ft, deeper than the 39 ft" in deeper.detail
    assert deeper.at_s is not None


def test_first_dive_of_the_day_has_no_repeat_items():
    p = Profile.from_samples(*CLEAN, DEFAULTS.ascent_window_s)
    debrief = build_debrief(p, {}, DEFAULTS, [], True, None, None, day=DayPlace(1, 2))
    assert not _repeat(debrief)
