from pathlib import Path

import pytest

from app.analysis.thermocline import find_thermocline
from app.parsing.fit import parse_fit

FIT = Path(__file__).parent / "fixtures" / "fit" / "real"
K = 273.15


def _layered(top_c=26, bottom_c=17, layer=(6, 10)):
    """30 min at 1 Hz, 5 min each at 3-12 m in turn, warm above the layer and cold below."""
    times, depths, temps = [], [], []
    for i, depth in enumerate([3, 5, 8, 11, 12, 4]):
        for s in range(300):
            times.append(i * 300 + s)
            depths.append(depth + 0.5)
            temps.append(K + (top_c if depth < layer[0] else bottom_c if depth >= layer[1] else (top_c + bottom_c) / 2))
    return times, depths, temps


def test_finds_the_layer():
    th = find_thermocline(*_layered())
    # The 5 m bin is warm, 8 m halfway and 11 m cold. 5 m and 11 m are more than 4 m apart, so
    # the layer found is one half of the drop, with the 8 m bin (8.5 m centre) at one edge
    assert th is not None
    assert th.above_k - th.below_k == pytest.approx(4.5)
    assert 8.5 in (th.top_m, th.bottom_m)


def test_no_thermocline_in_even_water():
    times, depths, _ = _layered()
    assert find_thermocline(times, depths, [K + 24] * len(times)) is None


def test_first_minutes_are_skipped_while_the_sensor_settles():
    times, depths, temps = _layered(top_c=24, bottom_c=24)
    # A warm start that's really the air, then even water
    temps = [K + 30 if t < 180 else k for t, k in zip(times, temps)]
    assert find_thermocline(times, depths, temps) is None


def test_real_quarry_dive():
    [dive] = parse_fit((FIT / "2026-08-09-10-05-30.fit").read_bytes()).dives
    th = find_thermocline([s.t_s for s in dive.samples], [s.depth_m for s in dive.samples], [s.temp_k for s in dive.samples])
    assert (th.top_m, th.bottom_m) == (6.5, 10.5)
    assert (round(th.above_k - K), round(th.below_k - K)) == (25, 17)
