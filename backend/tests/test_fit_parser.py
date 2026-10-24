"""FIT parsing, checked against the UDDF exports of the same three real dives.

Milestone 4 is done when each .fit dive matches its stored UDDF version
within 0.2 m max depth and 60 s duration, with the same fingerprint.
"""
from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.analysis.stats import fingerprint, summarize
from app.parsing.fit import FITParseError, parse_fit
from app.parsing.uddf import parse_uddf

FIXTURES = Path(__file__).parent / "fixtures"
PAIRS = [
    ("2026-08-09-12-02-28.fit", "test_dive.uddf"),
    ("2026-08-09-10-05-30.fit", "test_dive_2.uddf"),
    ("2026-08-08-15-21-24.fit", "test_dive_3.uddf"),
]


def _fit(name):
    return parse_fit((FIXTURES / "fit" / "real" / name).read_bytes())


@pytest.mark.parametrize("fit_name, uddf_name", PAIRS)
def test_fit_matches_uddf_export(fit_name, uddf_name):
    [fit] = _fit(fit_name).dives
    [uddf] = parse_uddf((FIXTURES / "uddf" / "real" / uddf_name).read_bytes()).dives
    assert fit.started_at == uddf.started_at
    assert fingerprint(fit.started_at) == fingerprint(uddf.started_at)
    a, b = summarize(fit), summarize(uddf)
    assert abs(a.max_depth_m - b.max_depth_m) <= 0.2
    assert abs(a.duration_s - b.duration_s) <= 60


def test_fit_metadata_and_extra_channels():
    result = _fit("2026-08-09-12-02-28.fit")
    assert result.warnings == []
    [dive] = result.dives
    # 16:02:28 UTC, recorded at UTC-4: stored as local wall-clock time
    assert dive.started_at == datetime(2026, 8, 9, 12, 2, 28, tzinfo=timezone.utc)
    assert dive.computer_model == "Garmin Descent G2"
    assert dive.computer_serial == "3628873032"
    assert dive.water_type == "fresh"
    # No GPS fix at the start of this dive, so the exit point is used
    assert dive.latitude == pytest.approx(41.3709, abs=1e-4)
    assert dive.longitude == pytest.approx(-83.3155, abs=1e-4)
    assert dive.entry is None
    assert dive.exit == pytest.approx((41.370896, -83.315543), abs=1e-6)

    first = dive.samples[0]
    assert (first.t_s, first.depth_m, first.heart_rate) == (0, 1.693, 81)
    assert first.temp_k == pytest.approx(300.15)
    assert any(s.ndl_s for s in dive.samples)
    # Descent G2 without a transmitter: no tank pressure
    assert all(s.tank_pressure_bar is None for s in dive.samples)


def test_start_position_preferred_when_present():
    [dive] = _fit("2026-08-08-15-21-24.fit").dives
    assert dive.latitude == pytest.approx(41.37065, abs=1e-4)
    assert dive.entry == pytest.approx((41.37065, -83.315608), abs=1e-6)
    assert dive.exit == pytest.approx((41.370493, -83.315226), abs=1e-6)


@pytest.mark.parametrize(
    "data, message",
    [
        (b"not a fit file at all", "Not a FIT file"),
        (b"", "Not a FIT file"),
    ],
)
def test_rejects_non_fit_data(data, message):
    with pytest.raises(FITParseError, match=message):
        parse_fit(data)


def test_rejects_damaged_file():
    data = bytearray((FIXTURES / "fit" / "real" / PAIRS[0][0]).read_bytes())
    data[500] ^= 0xFF
    with pytest.raises(FITParseError, match="damaged"):
        parse_fit(bytes(data))


def test_transmitter_pressures_become_a_sampled_tank():
    from app.models import Dive, DiveTank
    from app.parsing.model import ParsedDive, ParsedSample
    from app.routers.uploads import _sampled_tank

    start = datetime(2026, 8, 1, tzinfo=timezone.utc)
    samples = [ParsedSample(t, 10, None, tank_pressure_bar=p) for t, p in ((0, None), (1, 205), (2, 120), (3, 55))]
    dive = Dive(tank=DiveTank(volume_l=11.1, start_bar=200, end_bar=60, source="manual"))
    _sampled_tank(dive, ParsedDive(start, samples))
    # The tank size the diver entered is kept
    assert (dive.tank.volume_l, dive.tank.start_bar, dive.tank.end_bar, dive.tank.source) == (
        11.1, 205, 55, "sampled",
    )

    # No transmitter: a manual tank is left alone
    dive = Dive(tank=DiveTank(volume_l=11.1, start_bar=200, end_bar=60, source="manual"))
    _sampled_tank(dive, ParsedDive(start, [ParsedSample(0, 10, None)]))
    assert dive.tank.source == "manual"
