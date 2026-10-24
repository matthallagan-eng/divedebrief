"""Ascent control score.

Also records the median and fastest smoothed rate over the ascent time, for
the ascent-rate trend in the logbook.

1. Ascent time is every second (1 s grid) where the smoothed rate is above
   ASCENDING_MIN_RATE and the diver is below the surface threshold, so
   buoyancy wobble and surface swimming don't count.
2. Each ascent second is weighted 1, or ascent_final_zone_weight when it is
   in the final zone (depth at or shallower than ascent_final_zone_m), because
   the last metres matter most.
3. Base = weighted % of ascent time at or under the target rate.
4. Every run above the violation rate lasting at least MIN_SEGMENT_S costs
   VIOLATION_PENALTY points, up to PENALTY_CAP.
5. Score = base - penalties, clamped to 0-100.

Dives with less than MIN_ASCENT_S of ascent time are N/A.
"""
import statistics

from ..analysis.stats import SURFACE_THRESHOLD_M
from .common import Profile, Region, SkillResult, runs
from .settings import ScoringSettings

SKILL = "ascent"
ASCENDING_MIN_RATE = 3.0  # m/min
MIN_SEGMENT_S = 3
MIN_ASCENT_S = 10
VIOLATION_PENALTY = 10
PENALTY_CAP = 40


def score_ascent(p: Profile, cfg: ScoringSettings) -> SkillResult:
    ascending = [r > ASCENDING_MIN_RATE and d > SURFACE_THRESHOLD_M for r, d in zip(p.rate, p.depth)]
    if sum(ascending) < MIN_ASCENT_S:
        return SkillResult(SKILL, None, "No ascent found in the profile.")

    target = cfg.ascent_target_m_per_min
    limit = cfg.ascent_violation_m_per_min
    total = within = 0.0
    for asc, r, d in zip(ascending, p.rate, p.depth):
        if not asc:
            continue
        w = cfg.ascent_final_zone_weight if d <= cfg.ascent_final_zone_m else 1.0
        total += w
        if r <= target:
            within += w
    base = 100 * within / total
    rising = [r for r, asc in zip(p.rate, ascending) if asc]
    metrics = {
        "median_ascent_m_per_min": round(statistics.median(rising), 2),
        "max_ascent_m_per_min": round(max(rising), 2),
    }

    def segments(threshold: float) -> list[tuple[int, int]]:
        return [
            (a, b) for a, b in runs([r > threshold for r in p.rate])
            if p.t[b] - p.t[a] >= MIN_SEGMENT_S
        ]

    over = segments(target)
    violations = segments(limit)
    penalty = min(VIOLATION_PENALTY * len(violations), PENALTY_CAP)
    score = round(min(100, max(0, base - penalty)))

    regions = []
    for a, b in over:
        peak = max(p.rate[a : b + 1])
        regions.append(Region(
            p.t[a], p.t[b],
            f"{peak:.0f} m/min from {p.depth[a]:.1f} m to {p.depth[b]:.1f} m",
            "violation" if peak > limit else "warning",
        ))

    if not over:
        fastest = max(rising)
        reason = f"All ascent within {target:g} m/min; fastest {fastest:.1f} m/min."
    else:
        a, b = max(over, key=lambda s: max(p.rate[s[0] : s[1] + 1]))
        peak = max(p.rate[a : b + 1])
        n = len(over)
        reason = (
            f"{n} segment{'s' if n != 1 else ''} over {target:g} m/min, fastest {peak:.0f} m/min "
            f"between {p.depth[a]:.0f} m and {p.depth[b]:.0f} m."
        )
        if violations:
            k = len(violations)
            reason += f" {k} over {limit:g} m/min."
    return SkillResult(SKILL, score, reason, regions, metrics)
