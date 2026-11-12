"""Where the sun is, for telling night dives apart.

Dive start times are the dive computer's wall clock, not UTC, so the UTC
instant is estimated from the longitude (solar time) plus summer time. That
can be out by an hour or so, which is why a night dive needs the sun well
below the horizon rather than just past sunset.
"""
import math
from datetime import datetime, timedelta

# Civil dusk: below this it's dark enough to need a torch
NIGHT_ALTITUDE_DEG = -6.0


def _summer_time(lat: float, month: int) -> int:
    if lat >= 0:
        return 1 if 4 <= month <= 10 else 0
    return 1 if month >= 10 or month <= 3 else 0


def estimated_utc(wall_clock: datetime, lat: float, lon: float) -> datetime:
    """The UTC instant of a wall-clock time at a place, roughly."""
    offset_h = lon / 15 + _summer_time(lat, wall_clock.month)
    return wall_clock.replace(tzinfo=None) - timedelta(hours=offset_h)


def solar_altitude(utc: datetime, lat: float, lon: float) -> float:
    """The sun's altitude in degrees (NOAA's low-precision formulas)."""
    day = utc.timetuple().tm_yday
    hours = utc.hour + utc.minute / 60 + utc.second / 3600
    g = 2 * math.pi / 365 * (day - 1 + (hours - 12) / 24)
    eq_time = 229.18 * (
        0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g)
        - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g)
    )
    decl = (
        0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g) - 0.006758 * math.cos(2 * g)
        + 0.000907 * math.sin(2 * g) - 0.002697 * math.cos(3 * g) + 0.00148 * math.sin(3 * g)
    )
    solar_minutes = hours * 60 + eq_time + 4 * lon
    hour_angle = math.radians(solar_minutes / 4 - 180)
    phi = math.radians(lat)
    cos_zenith = math.sin(phi) * math.sin(decl) + math.cos(phi) * math.cos(decl) * math.cos(hour_angle)
    return 90 - math.degrees(math.acos(max(-1.0, min(1.0, cos_zenith))))


def is_night(wall_clock: datetime, lat: float | None, lon: float | None) -> bool:
    """Whether a dive starting at this wall-clock time was in the dark."""
    if lat is None or lon is None:
        # No position: go by the clock alone
        return wall_clock.hour >= 21 or wall_clock.hour < 5
    return solar_altitude(estimated_utc(wall_clock, lat, lon), lat, lon) < NIGHT_ALTITUDE_DEG
