"""Scores for the three real Garmin Descent dives, checked in as fixtures.

The diver agreed the ascent and stop scores look right on 2026-10-22. If a
change moves any of these, check it against the dives before updating them.
"""
from pathlib import Path

import pytest

from app.parsing.uddf import parse_uddf
from app.scoring import ScoringSettings, overall_score, score_dive

REAL = Path(__file__).parent / "fixtures" / "uddf" / "real"


@pytest.mark.parametrize(
    "name, expected, overall",
    [
        ("test_dive.uddf", {"ascent": 81, "stop": 71, "buoyancy": 90}, 81),  # Aug 9 12:02
        ("test_dive_2.uddf", {"ascent": 90, "stop": 82, "buoyancy": 78}, 83),  # Aug 9 10:05
        ("test_dive_3.uddf", {"ascent": 85, "stop": 28, "buoyancy": 88}, 67),  # Aug 8 15:21
    ],
)
def test_real_dive_scores(name, expected, overall):
    [dive] = parse_uddf((REAL / name).read_bytes()).dives
    cfg = ScoringSettings()
    results = score_dive([s.t_s for s in dive.samples], [s.depth_m for s in dive.samples], cfg)
    scores = {r.skill: r.score for r in results}
    assert scores == expected
    assert overall_score(scores, cfg) == overall
