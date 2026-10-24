"""Normalized dive data shared by the UDDF and FIT parsers.

Everything is in SI units (seconds, meters, kelvin), except tank pressure,
which is in bar.
"""
from dataclasses import dataclass, field
from datetime import datetime


class ParseError(ValueError):
    pass


@dataclass(frozen=True)
class ParsedSample:
    t_s: float
    depth_m: float
    temp_k: float | None
    heart_rate: int | None = None
    tank_pressure_bar: float | None = None
    ndl_s: int | None = None


@dataclass
class ParsedDive:
    started_at: datetime
    samples: list[ParsedSample]
    uddf_id: str | None = None
    computer_model: str | None = None
    computer_serial: str | None = None
    water_type: str | None = None  # "salt" | "fresh"
    # Where the dive took place: the entry point, or the exit point when the
    # watch had no fix at the start. UDDF has only the site's position.
    latitude: float | None = None
    longitude: float | None = None
    # Surface GPS fixes going in and coming out (FIT only)
    entry: tuple[float, float] | None = None
    exit: tuple[float, float] | None = None


@dataclass
class ParseResult:
    dives: list[ParsedDive]
    # Non-fatal problems, e.g. a dive skipped because it had no samples
    warnings: list[str] = field(default_factory=list)
