"""Smoothed ascent-rate analysis.

Checked against tests/fixtures/ascent-golden.json, whose expected values are
derived by hand; re-derive them when the algorithm changes.

1. Linearly interpolate the profile onto a 1 s grid.
2. Rate at second i = (depth[i - h] - depth[i + h]) / (t[i + h] - t[i - h]),
   in m/min, positive when ascending. h = window_s // 2, clamped at the ends.
3. Seconds where rate > limit form runs; runs shorter than min_duration_s
   (end - start) are dropped as noise.
"""
from dataclasses import dataclass
from typing import Sequence

DEFAULT_WINDOW_S = 10
DEFAULT_MIN_DURATION_S = 3


@dataclass(frozen=True)
class Segment:
    start_s: float
    end_s: float
    peak_rate_m_per_min: float


def resample_1hz(times: Sequence[float], depths: Sequence[float]) -> tuple[list[float], list[float]]:
    if not times:
        return [], []
    out_t: list[float] = []
    out_d: list[float] = []
    j = 0
    t = float(times[0])
    end = float(times[-1])
    while t <= end:
        while j < len(times) - 2 and times[j + 1] < t:
            j += 1
        t0, t1 = times[j], times[min(j + 1, len(times) - 1)]
        d0, d1 = depths[j], depths[min(j + 1, len(times) - 1)]
        frac = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
        out_t.append(t)
        out_d.append(d0 + (d1 - d0) * frac)
        t += 1.0
    return out_t, out_d


def ascent_rates(
    times: Sequence[float], depths: Sequence[float], window_s: int = DEFAULT_WINDOW_S
) -> list[float]:
    """Smoothed ascent rate (m/min) at each point of a 1 Hz series."""
    n = len(times)
    h = max(window_s // 2, 1)
    rates = []
    for i in range(n):
        lo, hi = max(i - h, 0), min(i + h, n - 1)
        span = times[hi] - times[lo]
        rates.append(0.0 if span == 0 else (depths[lo] - depths[hi]) / span * 60.0)
    return rates


def violation_segments(
    times: Sequence[float],
    depths: Sequence[float],
    limit_m_per_min: float,
    window_s: int = DEFAULT_WINDOW_S,
    min_duration_s: float = DEFAULT_MIN_DURATION_S,
) -> list[Segment]:
    grid_t, grid_d = resample_1hz(times, depths)
    rates = ascent_rates(grid_t, grid_d, window_s)

    segments: list[Segment] = []
    start: int | None = None
    for i, rate in enumerate(rates + [float("-inf")]):
        if rate > limit_m_per_min:
            if start is None:
                start = i
        elif start is not None:
            end = i - 1
            if grid_t[end] - grid_t[start] >= min_duration_s:
                peak = max(rates[start : end + 1])
                segments.append(Segment(grid_t[start], grid_t[end], peak))
            start = None
    return segments
