from datetime import datetime, timezone

import pytest

from app.analysis.stats import fingerprint, summarize
from app.parsing.uddf import ParsedDive, ParsedSample

START = datetime(2026, 3, 14, 9, 30, tzinfo=timezone.utc)


def _dive(points, started_at=START, **kwargs):
    return ParsedDive(
        started_at=started_at,
        samples=[ParsedSample(t, d, temp) for t, d, temp in points],
        **kwargs,
    )


def test_summarize_uses_time_weighted_average():
    # 10 s descending to 10 m, then 20 s at 10 m: area 50 + 200 over 30 s
    stats = summarize(_dive([(0, 0, None), (10, 10, 300.0), (30, 10, 295.0)]))
    assert stats.duration_s == 30
    assert stats.max_depth_m == 10
    assert stats.avg_depth_m == pytest.approx(250 / 30)
    assert stats.min_temp_k == 295.0


def test_summarize_single_sample():
    stats = summarize(_dive([(0, 4.2, None)]))
    assert stats.duration_s == 0
    assert stats.avg_depth_m == 4.2
    assert stats.min_temp_k is None


def test_fingerprint_ignores_metadata_and_float_noise():
    a = _dive([(0, 0, 300.0), (60, 10.01, 299.0)], computer_model="Descent Mk2i")
    b = _dive([(0, 0, None), (60, 10.04, None)], uddf_id="other")
    assert fingerprint(a) == fingerprint(b)


def test_fingerprint_changes_with_start_time_or_profile():
    base = _dive([(0, 0, None), (60, 10, None)])
    later = _dive([(0, 0, None), (60, 10, None)], started_at=START.replace(hour=11))
    deeper = _dive([(0, 0, None), (60, 12, None)])
    assert len({fingerprint(base), fingerprint(later), fingerprint(deeper)}) == 3


def test_summarize_excludes_surface_time():
    # 60 s at 10 m, 60 s bobbing at the surface, 60 s at 10 m, then 120 s
    # floating after the dive; only the intervals touching depth count
    stats = summarize(_dive([
        (0, 10, None), (60, 10, None),
        (61, 0.3, None), (120, 0.2, None),
        (121, 10, None), (181, 10, None),
        (182, 0.1, None), (300, 0.0, None),
    ]))
    # Underwater intervals: 0-60, 60-61, 120-121, 121-181, 181-182
    assert stats.duration_s == 123
    assert stats.avg_depth_m == pytest.approx((600 + 5.15 + 5.1 + 600 + 5.05) / 123)
    assert stats.max_depth_m == 10


def test_summarize_never_submerged_uses_whole_profile():
    stats = summarize(_dive([(0, 0.2, None), (30, 0.4, None)]))
    assert stats.duration_s == 30
    assert stats.avg_depth_m == pytest.approx(0.3)
