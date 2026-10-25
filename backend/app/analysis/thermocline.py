"""Thermocline detection from the dive computer's temperature readings.

The watch's sensor takes minutes to settle after it enters the water, so the
first SETTLE_S are skipped, and readings are pooled by depth over the whole
dive rather than read off the descent:

1. Bin readings into 1 m depth bins (bin k covers k to k + 1 m) and take each
   bin's median. Bins with fewer than MIN_READINGS are dropped.
2. The thermocline is the pair of bins at most MAX_SPAN_M apart with the
   biggest drop in temperature going deeper; ties go to the thinner layer.
3. Under MIN_DROP_K of drop is no thermocline.

Depths are bin centres, so a layer from bin 6 to bin 10 is 6.5 to 10.5 m.
"""
import statistics
from collections import defaultdict
from dataclasses import dataclass

SETTLE_S = 180
MIN_READINGS = 10
MAX_SPAN_M = 4
MIN_DROP_K = 3.0
MIN_DEPTH_M = 1.0


@dataclass(frozen=True)
class Thermocline:
    top_m: float
    bottom_m: float
    above_k: float  # median temperature at the top of the layer
    below_k: float  # and at its bottom


def find_thermocline(times, depths, temps_k) -> Thermocline | None:
    bins: dict[int, list[float]] = defaultdict(list)
    for t, d, k in zip(times, depths, temps_k):
        if k is None or t < SETTLE_S or d < MIN_DEPTH_M:
            continue
        bins[int(d)].append(k)
    medians = {b: statistics.median(v) for b, v in bins.items() if len(v) >= MIN_READINGS}

    best = None  # (drop, -span, top, bottom)
    for top, warm in medians.items():
        for bottom, cold in medians.items():
            if not 0 < bottom - top <= MAX_SPAN_M:
                continue
            key = (warm - cold, -(bottom - top), top, bottom)
            if best is None or key > best:
                best = key
    if best is None or best[0] < MIN_DROP_K:
        return None
    _, _, top, bottom = best
    return Thermocline(top + 0.5, bottom + 0.5, medians[top], medians[bottom])
