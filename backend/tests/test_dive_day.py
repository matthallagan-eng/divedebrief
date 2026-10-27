"""Repeat dives: grouping by calendar day and surface intervals."""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.dive_day import DayPlace, day_bounds, place_in_day


@dataclass
class D:
    id: int
    started_at: datetime
    duration_s: float
    max_depth_m: float = 10.0


def at(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 8, day, hour, minute, tzinfo=timezone.utc)


def test_first_dive_of_the_day_has_no_interval():
    assert place_in_day([D(1, at(9, 10), 2400)]) == {1: DayPlace(1, 1)}


def test_interval_runs_from_the_previous_dive_end():
    # Given out of order: placement sorts by start time
    places = place_in_day([D(2, at(9, 12, 2), 1800, 14.0), D(1, at(9, 10), 2400, 9.0)])
    assert places[1] == DayPlace(1, 2)
    # 10:00 + 40 min = 10:40, so 1 h 22 min to 12:02
    assert places[2] == DayPlace(2, 2, 82 * 60, 1, 9.0)


def test_days_are_counted_separately():
    places = place_in_day([D(1, at(8, 15), 2400), D(2, at(9, 10), 2400), D(3, at(9, 12), 2400)])
    assert (places[1].dive_of_day, places[1].dives_that_day) == (1, 1)
    assert places[2] == DayPlace(1, 2)
    assert places[3].dive_of_day == 2 and places[3].previous_dive_id == 2


def test_overlapping_times_never_give_a_negative_interval():
    places = place_in_day([D(1, at(9, 10), 3600), D(2, at(9, 10, 30), 600)])
    assert places[2].surface_interval_s == 0


def test_dates_are_read_in_utc():
    # The same instant shown in another zone is still 9 August
    late = at(9, 23).astimezone(timezone(timedelta(hours=3)))
    assert place_in_day([D(1, at(9, 10), 600), D(2, late, 600)])[2].dive_of_day == 2
    assert day_bounds(late) == (at(9, 0), at(10, 0))
