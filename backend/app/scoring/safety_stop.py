"""Safety stop score.

Dives shallower than stop_min_dive_depth_m are N/A.

1. Search the 1 s grid from the deepest point to the last second below the
   surface threshold.
2. A second is "holding" when it is inside the loose band (the stop band
   widened by stop_tolerance_m on both sides) and the diver is roughly still: the rate smoothed over STATIONARY_WINDOW_S is within
   STATIONARY_RATE either way. The long window averages out bobbing around
   the stop depth, but steady swimming up through the band without pausing
   still shows its rate, so it isn't a stop.
3. Candidate stops are runs inside the loose band, where dips outside it
   shorter than MIN_EXIT_S don't break the run. The candidate with the most
   holding seconds wins.
4. If no candidate has MIN_STOP_S of holding, the stop was skipped: score 0.
5. Within the winning candidate, from its first to its last holding second:
   - held = holding seconds
   - exits = times the diver left the stop band itself for at least
     MIN_EXIT_S and came back. Time in the tolerance still counts as held,
     but drifting past the band edge costs stability points. Shorter blips
     are sensor noise at the edge.
   - drift = shallowest to deepest point while roughly still
6. Score = 70 x min(held / target, 1) + 30 stability points, less
   EXIT_PENALTY per exit (max 3 exits counted) and DRIFT_PENALTY per metre of
   drift beyond DRIFT_ALLOWANCE_M (max 15 points).
"""
from ..analysis.ascent import ascent_rates
from ..analysis.stats import SURFACE_THRESHOLD_M
from .common import Profile, Region, SkillResult, bridge, fmt_mmss, runs
from .settings import ScoringSettings

SKILL = "stop"
STATIONARY_WINDOW_S = 30
STATIONARY_RATE = 3.0  # m/min
MIN_STOP_S = 30
MIN_EXIT_S = 5
EXIT_PENALTY = 5
DRIFT_ALLOWANCE_M = 1.5
DRIFT_PENALTY = 5  # per metre beyond the allowance
DRIFT_PENALTY_CAP = 15
STEADY_RANGE_M = 0.3  # less drift than this reads as "steady"


def score_stop(p: Profile, cfg: ScoringSettings) -> SkillResult:
    max_depth = max(p.depth, default=0.0)
    if max_depth < cfg.stop_min_dive_depth_m:
        return SkillResult(
            SKILL, None,
            f"Max depth {max_depth:.1f} m is under {cfg.stop_min_dive_depth_m:g} m, so no stop is expected.",
        )

    lo, hi = cfg.stop_band_min_m, cfg.stop_band_max_m
    tol = cfg.stop_tolerance_m
    deepest = p.depth.index(max_depth)
    below = [i for i, d in enumerate(p.depth) if d > SURFACE_THRESHOLD_M]
    last = below[-1] if below else len(p.depth) - 1

    window = range(deepest, last + 1)
    in_loose = bridge([lo - tol <= p.depth[i] <= hi + tol for i in window], MIN_EXIT_S)
    in_band = [lo <= p.depth[i] <= hi for i in window]
    slow_rate = ascent_rates(p.t, p.depth, STATIONARY_WINDOW_S)
    still = [abs(slow_rate[i]) <= STATIONARY_RATE for i in window]
    holding = [b and s for b, s in zip(in_loose, still)]

    best = None
    for a, b in runs(in_loose):
        held = sum(holding[a : b + 1])
        if best is None or held > best[2]:
            best = (a, b, held)

    band = f"{lo:g} and {hi:g} m"
    if best is None or best[2] < MIN_STOP_S:
        return SkillResult(SKILL, 0, f"No stop found between {band} before surfacing.")

    a, b, held = best
    hold = [i for i in range(a, b + 1) if holding[i]]
    h0, h1 = hold[0], hold[-1]
    exits = sum(
        1 for x, y in runs([not in_band[i] for i in range(h0, h1 + 1)]) if y - x + 1 >= MIN_EXIT_S
    )
    depths = [p.depth[deepest + i] for i in range(h0, h1 + 1) if still[i]]
    shallow, deep = min(depths), max(depths)

    time_pts = 70 * min(held / cfg.stop_target_s, 1.0)
    drift_pen = min(DRIFT_PENALTY * max(0.0, deep - shallow - DRIFT_ALLOWANCE_M), DRIFT_PENALTY_CAP)
    stability = 30 - EXIT_PENALTY * min(exits, 3) - drift_pen
    score = round(min(100, max(0, time_pts + stability)))

    if deep - shallow < STEADY_RANGE_M:
        drift = f"steady at {(shallow + deep) / 2:.1f} m"
    else:
        drift = f"drifted between {shallow:.1f} m and {deep:.1f} m"
    reason = f"Held {fmt_mmss(held)} of {fmt_mmss(cfg.stop_target_s)}, {drift}."
    if exits:
        reason += f" Left the band {exits} time{'s' if exits != 1 else ''}."

    start_s, end_s = p.t[deepest + h0], p.t[deepest + h1]
    region = Region(start_s, end_s, f"Stop: held {fmt_mmss(held)}")
    return SkillResult(SKILL, score, reason, [region])
