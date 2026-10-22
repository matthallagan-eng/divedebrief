"""Buoyancy stability score.

1. Split the dive into underwater segments at surface intervals (depth at or
   above the surface threshold). Segments shorter than MIN_PHASE_S are
   ignored. Each segment gets its own bottom phase, so a mid-dive surface
   swim isn't counted as instability.
2. Bottom phase of a segment:
   - Descent ends at the first point within PLATEAU_BAND_M of the first
     plateau: the first run of PLATEAU_S seconds where the rate smoothed
     over STILL_WINDOW_S stays within STILL_RATE either way.
   - The final ascent mirrors that: it starts at the last point within
     PLATEAU_BAND_M of the last plateau before the diver left for good. "For
     good" means the last time deeper than the safety stop band plus its
     tolerance (stop_band_max_m + stop_tolerance_m, the same edge the stop
     score uses), so the stop and the climb to it are left out. If the
     segment never goes that deep, the last plateau of the segment is used.
   Bottom phases shorter than MIN_PHASE_S are dropped. Under MIN_BOTTOM_S of
   bottom time in total is N/A.
3. Detrend each bottom phase with a rolling median over
   buoyancy_detrend_window_s (clipped to the phase), so deliberate depth
   changes along a reef don't count.
4. Metrics over all bottom phases:
   - wobble = standard deviation of the detrended depth
   - excursions = runs where the detrended depth is more than
     buoyancy_excursion_m off, lasting at least MIN_EXCURSION_S. Gaps under
     MERGE_GAP_S are bridged, so one bob up and back is one excursion.
5. Score = up to 60 points for wobble (full at WOBBLE_GOOD_M, none at
   WOBBLE_BAD_M, linear between) + up to 40 points for excursions, less
   EXCURSION_PENALTY per excursion per 10 minutes of bottom time.
"""
import statistics

from ..analysis.ascent import ascent_rates
from ..analysis.stats import SURFACE_THRESHOLD_M
from .common import Profile, Region, SkillResult, bridge, runs
from .settings import ScoringSettings

SKILL = "buoyancy"
STILL_WINDOW_S = 30
STILL_RATE = 3.0  # m/min
PLATEAU_S = 30
PLATEAU_BAND_M = 1.0
MIN_PHASE_S = 60
MIN_BOTTOM_S = 180
MIN_EXCURSION_S = 5
MERGE_GAP_S = 5
WOBBLE_GOOD_M = 0.25
WOBBLE_BAD_M = 1.0
EXCURSION_PENALTY = 10  # per excursion per 10 minutes


def _bottom_phase(depth: list[float], still: list[bool], a: int, b: int, ascent_depth: float):
    """(start, end) indices of the bottom phase in segment a..b, or None."""
    plateaus = [r for r in runs(still[a : b + 1]) if r[1] - r[0] + 1 >= PLATEAU_S]
    if not plateaus:
        return None
    first = a + plateaus[0][0]
    start = next(i for i in range(a, first + 1) if depth[i] >= depth[first] - PLATEAU_BAND_M)

    deep = [i for i in range(start, b + 1) if depth[i] > ascent_depth]
    leave = deep[-1] if deep else b
    ends = [a + y for x, y in plateaus if a + x <= leave]
    if not ends:
        return None
    last = min(ends[-1], leave)
    end = max(i for i in range(last, leave + 1) if depth[i] >= depth[last] - PLATEAU_BAND_M)
    return (start, end) if end - start + 1 >= MIN_PHASE_S else None


def _detrend(depth: list[float], start: int, end: int, window_s: int) -> list[float]:
    h = window_s // 2
    return [
        depth[i] - statistics.median(depth[max(start, i - h) : min(end, i + h) + 1])
        for i in range(start, end + 1)
    ]


def score_buoyancy(p: Profile, cfg: ScoringSettings) -> SkillResult:
    slow = ascent_rates(p.t, p.depth, STILL_WINDOW_S)
    still = [abs(r) <= STILL_RATE and d > SURFACE_THRESHOLD_M for r, d in zip(slow, p.depth)]
    segments = [s for s in runs([d > SURFACE_THRESHOLD_M for d in p.depth]) if s[1] - s[0] + 1 >= MIN_PHASE_S]
    phases = [ph for a, b in segments if (ph := _bottom_phase(p.depth, still, a, b, cfg.stop_band_max_m + cfg.stop_tolerance_m))]

    bottom_s = sum(e - s + 1 for s, e in phases)
    if bottom_s < MIN_BOTTOM_S:
        return SkillResult(SKILL, None, "No settled bottom phase of 3 minutes or more to judge.")

    residuals: list[float] = []
    excursions: list[tuple[int, int]] = []
    calm = (0, -1)  # longest stretch without an excursion
    for s, e in phases:
        res = _detrend(p.depth, s, e, cfg.buoyancy_detrend_window_s)
        residuals += res
        off = bridge([abs(r) > cfg.buoyancy_excursion_m for r in res], MERGE_GAP_S)
        found = [(s + x, s + y) for x, y in runs(off) if y - x + 1 >= MIN_EXCURSION_S]
        excursions += found
        edges = [s - 1] + [i for ex in found for i in ex] + [e + 1]
        for gap_start, gap_end in zip(edges[::2], edges[1::2]):
            if gap_end - gap_start > calm[1] - calm[0] + 2:
                calm = (gap_start + 1, gap_end - 1)

    wobble = statistics.pstdev(residuals)
    wobble_pts = 60 * min(1.0, max(0.0, (WOBBLE_BAD_M - wobble) / (WOBBLE_BAD_M - WOBBLE_GOOD_M)))
    per_10_min = len(excursions) / (bottom_s / 600)
    excursion_pts = max(0.0, 40 - EXCURSION_PENALTY * per_10_min)
    score = round(wobble_pts + excursion_pts)

    n = len(excursions)
    minutes = round(bottom_s / 60)
    limit = f"{cfg.buoyancy_excursion_m:g} m"
    if n:
        reason = f"{n} excursion{'s' if n != 1 else ''} over {limit} in {minutes} min at the bottom"
        reason += f"; steadiest stretch was minutes {round(p.t[calm[0]] / 60)}–{round(p.t[calm[1]] / 60)}."
    else:
        reason = f"No excursions over {limit} in {minutes} min at the bottom."
    reason += f" Typical wobble ±{wobble:.1f} m."

    # Excursions first: the profile colors each point by the first region covering it
    regions = [Region(p.t[s], p.t[e], "Excursion", "warning") for s, e in excursions]
    regions += [Region(p.t[s], p.t[e], "Bottom phase") for s, e in phases]
    return SkillResult(SKILL, score, reason, regions)
