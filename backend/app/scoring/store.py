"""Loading settings and keeping stored scores current."""
from dataclasses import asdict
from itertools import groupby

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Dive, DiveScore, Sample, UserSettings
from . import ALGORITHM_VERSION, ScoringSettings, score_dive

SKILLS = ("ascent", "stop")


def load_settings(db: Session, user_id: int) -> tuple[ScoringSettings, int]:
    """The diver's settings and their version (0 = never changed)."""
    row = db.get(UserSettings, user_id)
    if row is None:
        return ScoringSettings(), 0
    known = {k: v for k, v in row.data.items() if k in ScoringSettings.model_fields}
    return ScoringSettings(**known), row.version


def save_settings(db: Session, user_id: int, cfg: ScoringSettings) -> int:
    row = db.get(UserSettings, user_id)
    if row is None:
        row = UserSettings(user_id=user_id, data={}, version=0)
        db.add(row)
    row.data = cfg.model_dump()
    row.version += 1
    db.flush()
    return row.version


def _is_fresh(dive: Dive, settings_version: int) -> bool:
    return {s.skill for s in dive.scores} == set(SKILLS) and all(
        s.algorithm_version == ALGORITHM_VERSION and s.settings_version == settings_version
        for s in dive.scores
    )


def ensure_scores(db: Session, user_id: int, dives: list[Dive]) -> ScoringSettings:
    """Recompute scores for any of these dives that are missing or stale.
    Returns the settings used, for computing the overall score."""
    cfg, version = load_settings(db, user_id)
    stale = [d for d in dives if not _is_fresh(d, version)]
    if not stale:
        return cfg

    rows = db.execute(
        select(Sample.dive_id, Sample.t_s, Sample.depth_m)
        .where(Sample.dive_id.in_([d.id for d in stale]))
        .order_by(Sample.dive_id, Sample.t_s)
    ).all()
    samples = {k: list(g) for k, g in groupby(rows, key=lambda r: r.dive_id)}

    for dive in stale:
        series = samples.get(dive.id, [])
        results = score_dive([r.t_s for r in series], [r.depth_m for r in series], cfg)
        dive.scores = [
            DiveScore(
                skill=r.skill,
                score=r.score,
                reason=r.reason,
                regions=[asdict(g) for g in r.regions],
                algorithm_version=ALGORITHM_VERSION,
                settings_version=version,
            )
            for r in results
        ]
    db.commit()
    return cfg
