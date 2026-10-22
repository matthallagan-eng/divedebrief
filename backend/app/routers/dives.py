from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import Dive, User
from ..schemas import DiveDetail, DiveSummary, ProfilePoint, SampleOut, SkillScoreDetail
from ..scoring import Profile, ScoringSettings, overall_score
from ..scoring.store import SKILLS, ensure_scores

router = APIRouter(prefix="/dives", tags=["dives"])


def _summary_fields(dive: Dive, cfg: ScoringSettings) -> dict:
    scores = sorted(dive.scores, key=lambda s: SKILLS.index(s.skill))
    return dict(
        id=dive.id,
        upload_id=dive.upload_id,
        started_at=dive.started_at,
        duration_s=dive.duration_s,
        max_depth_m=dive.max_depth_m,
        avg_depth_m=dive.avg_depth_m,
        min_temp_k=dive.min_temp_k,
        computer_model=dive.computer_model,
        overall_score=overall_score({s.skill: s.score for s in scores}, cfg),
        scores=scores,
    )


@router.get("", response_model=list[DiveSummary])
def list_dives(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dives = db.scalars(
        select(Dive)
        .where(Dive.user_id == user.id)
        .options(selectinload(Dive.scores))
        .order_by(Dive.started_at.desc())
    ).all()
    cfg = ensure_scores(db, user.id, list(dives))
    return [DiveSummary(**_summary_fields(d, cfg)) for d in dives]


@router.get("/{dive_id}", response_model=DiveDetail)
def get_dive(dive_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dive = db.scalar(
        select(Dive)
        .where(Dive.id == dive_id, Dive.user_id == user.id)
        .options(selectinload(Dive.samples), selectinload(Dive.scores))
    )
    if dive is None:
        raise HTTPException(404, "Dive not found")
    cfg = ensure_scores(db, user.id, [dive])
    p = Profile.from_samples(
        [s.t_s for s in dive.samples], [s.depth_m for s in dive.samples], cfg.ascent_window_s
    )
    fields = _summary_fields(dive, cfg)
    fields["scores"] = [SkillScoreDetail.model_validate(s) for s in fields["scores"]]
    return DiveDetail(
        **fields,
        computer_serial=dive.computer_serial,
        water_type=dive.water_type,
        latitude=dive.latitude,
        longitude=dive.longitude,
        samples=[SampleOut.model_validate(s) for s in dive.samples],
        profile=[
            ProfilePoint(t_s=t, depth_m=d, rate_m_per_min=r) for t, d, r in zip(p.t, p.depth, p.rate)
        ],
    )


@router.delete("/{dive_id}", status_code=204)
def delete_dive(dive_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dive = db.scalar(select(Dive).where(Dive.id == dive_id, Dive.user_id == user.id))
    if dive is None:
        raise HTTPException(404, "Dive not found")
    db.delete(dive)
    db.commit()
