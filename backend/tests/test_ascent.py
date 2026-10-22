import json
from pathlib import Path

import pytest

from app.analysis.ascent import resample_1hz, violation_segments

GOLDEN = Path(__file__).parent / "fixtures" / "ascent-golden.json"
CASES = json.loads(GOLDEN.read_text())["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_golden(case):
    kwargs = {}
    if "window_s" in case:
        kwargs["window_s"] = case["window_s"]
    if "min_duration_s" in case:
        kwargs["min_duration_s"] = case["min_duration_s"]

    segments = violation_segments(case["times"], case["depths"], case["limit_m_per_min"], **kwargs)

    assert len(segments) == len(case["expected"])
    for seg, exp in zip(segments, case["expected"]):
        assert seg.start_s == pytest.approx(exp["start_s"], abs=1e-6)
        assert seg.end_s == pytest.approx(exp["end_s"], abs=1e-6)
        assert seg.peak_rate_m_per_min == pytest.approx(exp["peak_rate_m_per_min"], abs=1e-6)


def test_resample_interpolates_irregular_samples():
    t, d = resample_1hz([0, 2, 5], [0, 4, 10])
    assert t == [0, 1, 2, 3, 4, 5]
    assert d == pytest.approx([0, 2, 4, 6, 8, 10])


def test_resample_stops_at_last_whole_second():
    t, _ = resample_1hz([0, 2.5], [0, 5])
    assert t == [0, 1, 2]
