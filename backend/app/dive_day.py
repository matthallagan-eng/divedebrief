"""Repeat dives: where each dive falls in its day, and how long the diver
was at the surface before it.

Start times are the dive computer's wall-clock times, so dives on the same
calendar date are one dive day. The surface interval runs from the end of
the day's previous dive to the start of this one.
"""
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from typing import Iterable, Protocol


class DiveTimes(Protocol):
    id: int
    started_at: datetime
    duration_s: float
    max_depth_m: float


@dataclass(frozen=True)
class DayPlace:
    dive_of_day: int  # 1 for the day's first dive
    dives_that_day: int
    # None for the day's first dive
    surface_interval_s: float | None = None
    previous_dive_id: int | None = None
    previous_max_depth_m: float | None = None


def _date(started_at: datetime):
    # Wall-clock times are tagged as UTC, so the date is read in UTC
    return started_at.astimezone(timezone.utc).date()


def day_bounds(started_at: datetime) -> tuple[datetime, datetime]:
    """The start of the dive's calendar day and of the next one."""
    start = datetime.combine(_date(started_at), time(), tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


def place_in_day(dives: Iterable[DiveTimes]) -> dict[int, DayPlace]:
    days: dict = {}
    for d in sorted(dives, key=lambda d: d.started_at):
        days.setdefault(_date(d.started_at), []).append(d)
    out = {}
    for day in days.values():
        prev = None
        for n, d in enumerate(day, start=1):
            if prev is None:
                out[d.id] = DayPlace(n, len(day))
            else:
                ended = prev.started_at + timedelta(seconds=prev.duration_s)
                # Never negative, even if a computer's clock or duration is off
                interval = max(0.0, (d.started_at - ended).total_seconds())
                out[d.id] = DayPlace(n, len(day), interval, prev.id, prev.max_depth_m)
            prev = d
    return out
