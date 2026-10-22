import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.parsing.uddf import UDDFParseError, parse_uddf

FIXTURES = Path(__file__).parent / "fixtures" / "uddf"
SYNTHETIC = FIXTURES / "synthetic"
REAL = FIXTURES / "real"


def _parse(name: str):
    return parse_uddf((SYNTHETIC / name).read_bytes())


# --- synthetic fixtures ------------------------------------------------------

def test_single_namespaced_dive():
    result = _parse("single_dive.uddf")
    assert result.warnings == []
    [dive] = result.dives
    assert dive.uddf_id == "dive1"
    assert dive.started_at == datetime(2026, 3, 14, 9, 30, tzinfo=timezone.utc)
    assert dive.computer_model == "Descent Mk2i"
    assert dive.computer_serial == "TEST-0001"
    assert len(dive.samples) == 7
    assert dive.samples[2].t_s == 120
    assert dive.samples[2].depth_m == 18.5
    assert dive.samples[2].temp_k == pytest.approx(297.15)


def test_multiple_dives_across_repetition_groups():
    dives = _parse("multi_dive.uddf").dives
    assert [d.uddf_id for d in dives] == ["a", "b", "c"]
    # Explicit offsets are kept rather than coerced to UTC
    assert dives[0].started_at.utcoffset() == timedelta(hours=1)
    assert dives[2].started_at.tzinfo is not None


def test_ambiguous_dive_computer_is_not_attributed():
    dive = _parse("multi_dive.uddf").dives[0]
    assert dive.computer_model is None
    assert dive.computer_serial is None


def test_samples_sorted_deduped_and_event_waypoints_skipped():
    samples = _parse("multi_dive.uddf").dives[0].samples
    assert [s.t_s for s in samples] == [0, 30, 60, 90]
    # First of two waypoints at t=30 wins
    assert samples[1].depth_m == 6


def test_missing_temperature_is_none():
    [dive] = _parse("missing_temperature.uddf").dives
    assert all(s.temp_k is None for s in dive.samples)
    assert dive.computer_model is None


def test_dive_without_samples_is_skipped_with_warning():
    result = _parse("empty_profile.uddf")
    assert [d.uddf_id for d in result.dives] == ["good"]
    assert len(result.warnings) == 1
    assert "empty" in result.warnings[0]


def test_malformed_xml_raises():
    with pytest.raises(UDDFParseError, match="Not valid XML"):
        _parse("malformed.uddf")


def test_non_uddf_root_raises():
    with pytest.raises(UDDFParseError, match="Not a UDDF file"):
        parse_uddf(b"<gpx><trk/></gpx>")


def test_file_with_no_dives_raises():
    with pytest.raises(UDDFParseError, match="no dives"):
        parse_uddf(b'<uddf version="3.2.0"><profiledata/></uddf>')


def test_all_dives_unusable_raises_with_reasons():
    xml = b"""<uddf><profiledata><repetitiongroup>
        <dive id="x"><samples><waypoint><divetime>0</divetime><depth>1</depth></waypoint></samples></dive>
    </repetitiongroup></profiledata></uddf>"""
    with pytest.raises(UDDFParseError, match="missing start datetime"):
        parse_uddf(xml)


def test_non_numeric_depth_skips_dive():
    xml = b"""<uddf><profiledata><repetitiongroup>
        <dive id="bad"><informationbeforedive><datetime>2026-01-01T00:00:00</datetime></informationbeforedive>
          <samples><waypoint><divetime>0</divetime><depth>deep</depth></waypoint></samples></dive>
        <dive id="ok"><informationbeforedive><datetime>2026-01-01T02:00:00</datetime></informationbeforedive>
          <samples><waypoint><divetime>0</divetime><depth>1</depth></waypoint></samples></dive>
    </repetitiongroup></profiledata></uddf>"""
    result = parse_uddf(xml)
    assert [d.uddf_id for d in result.dives] == ["ok"]
    assert "not a number" in result.warnings[0]


def test_external_entities_are_not_resolved(tmp_path):
    secret = tmp_path / "secret.txt"
    secret.write_text("TOP-SECRET")
    xml = f"""<?xml version="1.0"?>
<!DOCTYPE uddf [<!ENTITY xxe SYSTEM "{secret.as_uri()}">]>
<uddf><diver><owner><equipment><divecomputer><model>&xxe;</model></divecomputer></equipment></owner></diver>
<profiledata><repetitiongroup><dive>
  <informationbeforedive><datetime>2026-01-01T00:00:00</datetime></informationbeforedive>
  <samples><waypoint><divetime>0</divetime><depth>1</depth></waypoint></samples>
</dive></repetitiongroup></profiledata></uddf>""".encode()
    [dive] = parse_uddf(xml).dives
    assert "TOP-SECRET" not in (dive.computer_model or "")


# --- real exports ------------------------------------------------------------
# Drop Subsurface UDDF exports in fixtures/uddf/real/. Each <name>.uddf may
# have a <name>.expected.json with values checked against your logbook:
#   {"dives": [{"started_at": "2026-03-14T09:30:00",
#               "max_depth_m": 18.4, "duration_s": 2700}]}

REAL_FILES = sorted(REAL.glob("*.uddf"))


@pytest.mark.skipif(not REAL_FILES, reason="no real UDDF exports in fixtures/uddf/real")
@pytest.mark.parametrize("path", REAL_FILES, ids=lambda p: p.name)
def test_real_export_is_plausible(path: Path):
    result = parse_uddf(path.read_bytes())
    assert result.dives
    for dive in result.dives:
        times = [s.t_s for s in dive.samples]
        assert times == sorted(times) and len(set(times)) == len(times)
        assert all(-1.0 <= s.depth_m <= 150.0 for s in dive.samples)
        temps = [s.temp_k for s in dive.samples if s.temp_k is not None]
        # Catches a tool writing Celsius where UDDF requires kelvin
        assert all(265.0 <= t <= 320.0 for t in temps)


REAL_WITH_EXPECTED = [p for p in REAL_FILES if p.with_suffix(".expected.json").exists()]


@pytest.mark.skipif(not REAL_WITH_EXPECTED, reason="no .expected.json files for real exports")
@pytest.mark.parametrize("path", REAL_WITH_EXPECTED, ids=lambda p: p.name)
def test_real_export_matches_logbook(path: Path):
    expected = json.loads(path.with_suffix(".expected.json").read_text())["dives"]
    dives = parse_uddf(path.read_bytes()).dives
    assert len(dives) == len(expected)
    for dive, exp in zip(dives, expected):
        assert dive.started_at.replace(tzinfo=None) == datetime.fromisoformat(exp["started_at"])
        assert max(s.depth_m for s in dive.samples) == pytest.approx(exp["max_depth_m"], abs=0.2)
        assert dive.samples[-1].t_s == pytest.approx(exp["duration_s"], abs=60)
