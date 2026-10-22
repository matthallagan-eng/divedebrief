import hashlib
from dataclasses import dataclass

from ..parsing.uddf import ParsedDive


@dataclass(frozen=True)
class DiveStats:
    duration_s: float
    max_depth_m: float
    avg_depth_m: float
    min_temp_k: float | None


# Shallower than this counts as being at the surface. Matches Subsurface's
# SURFACE_THRESHOLD, so duration and average depth agree with its logbook.
SURFACE_THRESHOLD_M = 0.75


def summarize(dive: ParsedDive) -> DiveStats:
    samples = dive.samples

    # Duration and average depth cover underwater time only: surface swims
    # mid-dive and trailing surface time are left out. Each interval with
    # either end below the threshold counts; the mean is time-weighted
    # (trapezoidal) so irregular sample spacing doesn't skew it.
    duration = area = 0.0
    for a, b in zip(samples, samples[1:]):
        if a.depth_m > SURFACE_THRESHOLD_M or b.depth_m > SURFACE_THRESHOLD_M:
            dt = b.t_s - a.t_s
            duration += dt
            area += dt * (a.depth_m + b.depth_m) / 2

    if duration > 0:
        avg = area / duration
    else:
        # Never went below the threshold; fall back to the whole profile
        duration = samples[-1].t_s - samples[0].t_s
        avg = sum(s.depth_m for s in samples) / len(samples)

    temps = [s.temp_k for s in samples if s.temp_k is not None]
    return DiveStats(
        duration_s=duration,
        max_depth_m=max(s.depth_m for s in samples),
        avg_depth_m=avg,
        min_temp_k=min(temps) if temps else None,
    )


def fingerprint(dive: ParsedDive) -> str:
    """Stable identity for a dive, independent of which file or tool it came from."""
    h = hashlib.sha256(dive.started_at.isoformat().encode())
    for s in dive.samples:
        h.update(f"|{s.t_s:.0f}:{s.depth_m:.1f}".encode())
    return h.hexdigest()
