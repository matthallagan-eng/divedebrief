"""Air efficiency score, from surface air consumption (SAC).

1. SAC (L/min) = pressure used (bar) x tank volume (L)
                 / (underwater minutes x average ambient pressure in ATA).
   The dive's stored duration and average depth cover the same underwater
   time, and ATA is linear in depth, so average ATA = avg depth / k + 1, with
   k = 10 m in salt water and 10.3 m in fresh. Water type comes from the dive
   (the FIT file) or the diver's default_water_type.
2. The baseline is the median SAC of the diver's previous BASELINE_DIVES
   dives that have one, by start time. Until there are that many, the score
   is N/A while the baseline builds.
3. Score = air_at_baseline at the baseline, air_points_per_pct per % better
   (lower SAC) or worse, clamped to 0-100, both set by the difficulty. On
   easy, about 17% better is 100 and 50% worse is 0.
"""
import statistics
from dataclasses import dataclass
from datetime import datetime

from . import units as u
from .common import SkillResult
from .difficulty import GRADING
from .settings import ScoringSettings

SKILL = "air"
BASELINE_DIVES = 5
METRES_PER_ATM = {"salt": 10.0, "fresh": 10.3}


@dataclass(frozen=True)
class AirInput:
    """What SAC needs from one dive and its tank."""

    started_at: datetime
    duration_s: float
    avg_depth_m: float
    water_type: str | None
    volume_l: float | None
    start_bar: float | None
    end_bar: float | None


def sac_l_min(a: AirInput, cfg: ScoringSettings) -> float | None:
    if a.volume_l is None or a.start_bar is None or a.end_bar is None:
        return None
    used = a.start_bar - a.end_bar
    if used <= 0 or a.duration_s <= 0:
        return None
    ata = a.avg_depth_m / METRES_PER_ATM[a.water_type or cfg.default_water_type] + 1
    return used * a.volume_l / (a.duration_s / 60 * ata)


def score_air(a: AirInput | None, history: list[AirInput], cfg: ScoringSettings) -> SkillResult:
    """history: the diver's other dives with tank data, any order."""
    if a is None or a.start_bar is None or a.end_bar is None:
        return SkillResult(SKILL, None, "No tank data. Add your tank and pressures to score air use.")
    if a.volume_l is None:
        return SkillResult(SKILL, None, "Add your tank size to work out air use.")
    sac = sac_l_min(a, cfg)
    if sac is None:
        return SkillResult(SKILL, None, "The tank pressures show no air used.")

    earlier = sorted((h for h in history if h.started_at < a.started_at), key=lambda h: h.started_at)
    baseline = [s for h in earlier if (s := sac_l_min(h, cfg)) is not None][-BASELINE_DIVES:]
    if len(baseline) < BASELINE_DIVES:
        return SkillResult(
            SKILL, None, f"{u.sac(sac, cfg.units)}. Building your baseline ({len(baseline)} of {BASELINE_DIVES})."
        )

    typical = statistics.median(baseline)
    pct = (typical - sac) / typical * 100  # positive = used less air
    g = GRADING[cfg.difficulty]
    score = round(min(100, max(0, g.air_at_baseline + g.air_points_per_pct * pct)))
    if round(pct) == 0:
        compared = "in line with"
    else:
        compared = f"{abs(round(pct))}% {'better' if pct > 0 else 'worse'} than"
    return SkillResult(SKILL, score, f"{u.sac(sac, cfg.units)}, {compared} your last {BASELINE_DIVES} dives.")
