"""Loading settings and keeping stored scores current."""
from dataclasses import asdict
from itertools import groupby

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Dive, DiveScore, DiveTank, Sample, Site, UserSettings
from . import ALGORITHM_VERSION, AirInput, ScoringSettings, score_air, score_dive

# Skills computed from a dive's own samples
SAMPLE_SKILLS = ("ascent", "stop", "buoyancy")
# Air efficiency is compared with the diver's earlier dives, so a tank edit
# changes later dives' scores too. It needs no samples and is cheap, so it is
# re-checked on every read instead of being invalidated.
SKILLS = SAMPLE_SKILLS + ("air",)


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
    scores = [s for s in dive.scores if s.skill in SAMPLE_SKILLS]
    return {s.skill for s in scores} == set(SAMPLE_SKILLS) and all(
        s.algorithm_version == ALGORITHM_VERSION and s.settings_version == settings_version
        for s in scores
    )


def ensure_scores(db: Session, user_id: int, dives: list[Dive]) -> ScoringSettings:
    """Recompute scores for any of these dives that are missing or stale.
    Returns the settings used, for computing the overall score."""
    cfg, version = load_settings(db, user_id)
    stale = [d for d in dives if not _is_fresh(d, version)]
    changed = _refresh_samples(db, stale, version, cfg)
    changed |= _refresh_air(db, user_id, dives, version, cfg)
    if changed:
        db.commit()
    return cfg


def _refresh_samples(db: Session, stale: list[Dive], version: int, cfg: ScoringSettings) -> bool:
    if not stale:
        return False

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
        ] + [s for s in dive.scores if s.skill not in SAMPLE_SKILLS]
    return True


def _refresh_air(
    db: Session, user_id: int, dives: list[Dive], version: int, cfg: ScoringSettings
) -> bool:
    rows = db.execute(
        select(
            Dive.id, Dive.started_at, Dive.duration_s, Dive.avg_depth_m,
            # The diver's choice for the site wins over the dive computer's setting
            func.coalesce(Site.water_type, Dive.water_type),
            DiveTank.volume_l, DiveTank.start_bar, DiveTank.end_bar,
        )
        .join(DiveTank, DiveTank.dive_id == Dive.id)
        .outerjoin(Site, Site.id == Dive.site_id)
        .where(Dive.user_id == user_id)
    ).all()
    inputs = {r.id: AirInput(*r[1:]) for r in rows}
    history = list(inputs.values())

    changed = False
    for dive in dives:
        result = score_air(inputs.get(dive.id), history, cfg)
        row = next((s for s in dive.scores if s.skill == "air"), None)
        if row is None:
            row = DiveScore(skill="air", regions=[])
            dive.scores.append(row)
        elif (row.score, row.reason, row.algorithm_version, row.settings_version) == (
            result.score, result.reason, ALGORITHM_VERSION, version,
        ):
            continue
        row.score = result.score
        row.reason = result.reason
        row.algorithm_version = ALGORITHM_VERSION
        row.settings_version = version
        changed = True
    return changed
