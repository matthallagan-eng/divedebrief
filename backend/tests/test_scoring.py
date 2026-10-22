"""Scores for synthetic profiles, derived by hand from the rules in
app/scoring/ascent_control.py and app/scoring/safety_stop.py.

Keyframe times are offset by fractions of a second where needed, so no grid
second lands exactly on a threshold and float rounding can't decide a case.
"""
import pytest

from app.scoring import ScoringSettings, overall_score, score_dive

DEFAULTS = ScoringSettings()


def _score(times, depths, cfg=DEFAULTS):
    ascent, stop = score_dive(times, depths, cfg)
    return ascent, stop


# --- ascent control -----------------------------------------------------------

def test_steady_6_m_per_min_ascent_scores_100():
    ascent, _ = _score([0, 60, 240], [18, 18, 0])
    assert ascent.score == 100
    assert ascent.reason == "All ascent within 9 m/min; fastest 6.0 m/min."
    assert ascent.regions == []


def test_steady_12_m_per_min_ascent_is_mostly_over_target():
    # Rate = 1.2 x (i - 55.25) while the 10 s window ramps in, so 58-62 are
    # ascending but within target and 63 onwards is 12 m/min. Ascending seconds
    # stop at 146 (0.85 m; 147 is above 0.75 m). Seconds 121-146 are in the
    # final 6 m and count double: base = 5 / (5 + 58 + 2 x 26) = 4.3.
    ascent, _ = _score([0, 60.25, 150.25], [18, 18, 0])
    assert ascent.score == 4
    assert ascent.reason == "1 segment over 9 m/min, fastest 12 m/min between 17 m and 0 m."
    [region] = ascent.regions
    assert (region.start_s, region.end_s, region.severity) == (63, 150, "warning")


def test_violation_costs_ten_points():
    # 6 m/min with a 10 s burst at 24 m/min from 10 m to 6 m. Over 9 m/min
    # from 157-173, over 18 m/min from 162-168: one violation.
    profile = ([0, 60, 160, 170, 230], [20, 20, 10, 6, 0])
    ascent, _ = _score(*profile)
    lenient, _ = _score(*profile, DEFAULTS.model_copy(update={"ascent_violation_m_per_min": 30}))
    assert ascent.score == lenient.score - 10
    assert ascent.reason == (
        "1 segment over 9 m/min, fastest 24 m/min between 10 m and 6 m. 1 over 18 m/min."
    )
    [region] = ascent.regions
    assert (region.start_s, region.end_s, region.severity) == (157, 173, "violation")


def test_no_ascent_is_not_scored():
    ascent, _ = _score([0, 600], [10, 10])
    assert ascent.score is None
    assert ascent.reason == "No ascent found in the profile."


# --- safety stop --------------------------------------------------------------

def test_shallow_dive_has_no_stop_score():
    _, stop = _score([0, 60, 600, 680], [0, 8, 8, 0])
    assert stop.score is None
    assert stop.reason == "Max depth 8.0 m is under 10 m, so no stop is expected."


def test_full_stop_at_5_m_scores_100():
    # Ascend at 6 m/min to 5 m, hold, ascend at 6 m/min. With the 30 s
    # stillness window the rate is 0.2 x (225.5 - i) on arrival, so holding
    # starts at 211; it ends at 410 on departure. 200 s held, no drift.
    _, stop = _score([0, 60.5, 210.5, 410.5, 460.5], [20, 20, 5, 5, 0])
    assert stop.score == 100
    assert stop.reason == "Held 3:20 of 3:00, steady at 5.0 m."
    [region] = stop.regions
    assert (region.start_s, region.end_s) == (211, 410)


def test_short_stop_with_excursion_into_tolerance():
    # Hold at 5 m, sink to 6.3 m for ~20 s, come back, hold, ascend.
    # The sink stays within the 0.5 m tolerance and |rate| <= 2.6 m/min over
    # 30 s, so all of 211-374 is holding: 164 s. Below the band 281-303
    # (23 s) = 1 exit. Drift 5.0-6.3 m = 1.3 m, within the 1.5 m allowance.
    # 70 x 164/180 + 30 - 5 = 88.8
    _, stop = _score(
        [0, 60.5, 210.5, 270.5, 283.5, 300.5, 313.5, 374.5, 424.5],
        [20, 20, 5, 5, 6.3, 6.3, 5, 5, 0],
    )
    assert stop.score == 89
    assert stop.reason == "Held 2:44 of 3:00, drifted between 5.0 m and 6.3 m. Left the band 1 time."


def test_swimming_straight_up_is_a_skipped_stop():
    _, stop = _score([0, 60.5, 260.5], [20, 20, 0])
    assert stop.score == 0
    assert stop.reason == "No stop found between 3 and 6 m before surfacing."
    assert stop.regions == []


# --- overall ------------------------------------------------------------------

@pytest.mark.parametrize(
    "scores, weights, expected",
    [
        ({"ascent": 80, "stop": 40}, {}, 60),
        ({"ascent": 80, "stop": None}, {}, 80),  # N/A skills are left out
        ({"ascent": None, "stop": None}, {}, None),
        ({"ascent": 80, "stop": 40}, {"weight_ascent": 3}, 70),
        ({"ascent": 80, "stop": 40}, {"weight_stop": 0}, 80),
    ],
)
def test_overall_score(scores, weights, expected):
    assert overall_score(scores, DEFAULTS.model_copy(update=weights)) == expected


def test_settings_validation():
    with pytest.raises(ValueError):
        ScoringSettings(ascent_target_m_per_min=12, ascent_violation_m_per_min=10)


def test_brief_dip_past_tolerance_does_not_split_the_stop():
    # Hold at 5 m with a 3 s dip to 7 m (past the 6.5 m tolerance) halfway.
    # Without bridging, each half would be a separate 2-minute candidate.
    times = [0, 60.5, 210.5, 310.5, 311.5, 312.5, 313.5, 413.5, 463.5]
    depths = [20, 20, 5, 5, 7, 7, 5, 5, 0]
    _, stop = _score(times, depths)
    [region] = stop.regions
    assert region.start_s < 220 and region.end_s > 400
