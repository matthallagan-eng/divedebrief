import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone

from ..parsing.model import ParsedDive


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


def fingerprint(started_at: datetime) -> str:
    """Stable identity for a dive, independent of which file or tool it came from.

    Only the start time (wall clock, to the second) goes in: tools resample
    and round the profile differently (Subsurface shifts samples by 1 s,
    rounds depth to 1 cm and fills gaps), so hashing samples would make the
    same dive from FIT and UDDF look different. A diver can't start two
    dives in the same second.
    """
    utc = started_at.astimezone(timezone.utc) if started_at.tzinfo else started_at
    return hashlib.sha256(utc.strftime("%Y-%m-%dT%H:%M:%S").encode()).hexdigest()
