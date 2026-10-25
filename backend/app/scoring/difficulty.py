"""How hard each skill is graded. The diver's thresholds (target rate, stop
band, excursion size, ...) stay as set; difficulty changes how much a miss
costs and how much slack comes for free.

Easy is how DiveDebrief has always graded, and suits newer divers. Normal and
Hard cost more per mistake and give less slack, for divers who want their
scores to keep pushing them.
"""
from dataclasses import dataclass
from typing import Literal

Difficulty = Literal["easy", "normal", "hard"]


@dataclass(frozen=True)
class Grading:
    # Ascent control: points lost per stretch over the violation rate, and the most lost that way
    ascent_violation_penalty: int
    ascent_over_target_penalty: int  # per stretch over the target rate, violation or not
    ascent_penalty_cap: int
    # Safety stop: points lost per exit from the band, and for drift beyond the allowance
    stop_exit_penalty: int
    stop_drift_allowance_m: float
    stop_drift_penalty: int  # per metre
    stop_drift_penalty_cap: int
    # Buoyancy: full wobble points at or under good, none at bad
    buoyancy_wobble_good_m: float
    buoyancy_wobble_bad_m: float
    buoyancy_excursion_penalty: int  # per excursion per 10 minutes
    # Air efficiency: the score for matching your baseline, and points per 1% better or worse
    air_at_baseline: int
    air_points_per_pct: float


GRADING: dict[str, Grading] = {
    "easy": Grading(
        ascent_violation_penalty=10, ascent_over_target_penalty=0, ascent_penalty_cap=40,
        stop_exit_penalty=5, stop_drift_allowance_m=1.5, stop_drift_penalty=5, stop_drift_penalty_cap=15,
        buoyancy_wobble_good_m=0.25, buoyancy_wobble_bad_m=1.0, buoyancy_excursion_penalty=10,
        air_at_baseline=75, air_points_per_pct=1.5,
    ),
    "normal": Grading(
        ascent_violation_penalty=15, ascent_over_target_penalty=2, ascent_penalty_cap=60,
        stop_exit_penalty=8, stop_drift_allowance_m=1.0, stop_drift_penalty=8, stop_drift_penalty_cap=20,
        buoyancy_wobble_good_m=0.2, buoyancy_wobble_bad_m=0.75, buoyancy_excursion_penalty=15,
        air_at_baseline=70, air_points_per_pct=2.0,
    ),
    "hard": Grading(
        ascent_violation_penalty=20, ascent_over_target_penalty=4, ascent_penalty_cap=80,
        stop_exit_penalty=10, stop_drift_allowance_m=0.6, stop_drift_penalty=12, stop_drift_penalty_cap=25,
        buoyancy_wobble_good_m=0.15, buoyancy_wobble_bad_m=0.5, buoyancy_excursion_penalty=20,
        air_at_baseline=65, air_points_per_pct=2.5,
    ),
}
