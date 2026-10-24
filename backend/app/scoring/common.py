from dataclasses import dataclass, field

from ..analysis.ascent import ascent_rates, resample_1hz


@dataclass(frozen=True)
class Profile:
    """A dive on a 1 s grid with smoothed ascent rate (m/min, positive = up)."""

    t: list[float]
    depth: list[float]
    rate: list[float]

    @classmethod
    def from_samples(cls, times, depths, window_s: int) -> "Profile":
        t, d = resample_1hz(times, depths)
        return cls(t, d, ascent_rates(t, d, window_s))


@dataclass(frozen=True)
class Region:
    """A stretch of the dive a score refers to, highlighted on the profile."""

    start_s: float
    end_s: float
    label: str
    severity: str = "info"  # info | warning | violation


@dataclass(frozen=True)
class SkillResult:
    skill: str
    score: int | None  # None = N/A, explained by reason
    reason: str
    regions: list[Region] = field(default_factory=list)
    # Numbers for trends across dives, e.g. ascent rates
    metrics: dict[str, float] = field(default_factory=dict)


def runs(flags: list[bool]) -> list[tuple[int, int]]:
    """Inclusive (start, end) index pairs of consecutive True values."""
    out = []
    start = None
    for i, f in enumerate(flags + [False]):
        if f and start is None:
            start = i
        elif not f and start is not None:
            out.append((start, i - 1))
            start = None
    return out


def bridge(flags: list[bool], max_gap: int) -> list[bool]:
    """Fill gaps of False shorter than max_gap that have True on both sides."""
    out = list(flags)
    for a, b in runs([not f for f in flags]):
        if a > 0 and b < len(flags) - 1 and b - a + 1 < max_gap:
            out[a : b + 1] = [True] * (b - a + 1)
    return out


def fmt_mmss(seconds: float) -> str:
    s = round(seconds)
    return f"{s // 60}:{s % 60:02d}"
