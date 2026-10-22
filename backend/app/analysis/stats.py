import hashlib
from dataclasses import dataclass

from ..parsing.uddf import ParsedDive


@dataclass(frozen=True)
class DiveStats:
    duration_s: float
    max_depth_m: float
    avg_depth_m: float
    min_temp_k: float | None


def summarize(dive: ParsedDive) -> DiveStats:
    samples = dive.samples
    duration = samples[-1].t_s - samples[0].t_s

    # Time-weighted (trapezoidal) mean, so irregular sample spacing doesn't skew it
    if duration > 0:
        area = sum(
            (b.t_s - a.t_s) * (a.depth_m + b.depth_m) / 2
            for a, b in zip(samples, samples[1:])
        )
        avg = area / duration
    else:
        avg = samples[0].depth_m

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
