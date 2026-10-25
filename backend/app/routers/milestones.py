from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..milestones import DiveRecord, Milestone, compute_milestones
from ..models import Dive, User
from ..schemas import MilestoneOut
from ..scoring import overall_score
from ..scoring.store import ensure_scores

router = APIRouter(prefix="/milestones", tags=["milestones"])


def load_milestones(db: Session, user: User) -> list[Milestone]:
    dives = db.scalars(
        select(Dive).where(Dive.user_id == user.id).options(selectinload(Dive.scores))
    ).all()
    cfg = ensure_scores(db, user.id, list(dives))
    records = [
        DiveRecord(
            id=d.id,
            started_at=d.started_at,
            duration_s=d.duration_s,
            site_id=d.site_id,
            overall=overall_score({s.skill: s.score for s in d.scores}, cfg),
            scores={s.skill: s.score for s in d.scores},
            regions={s.skill: s.regions for s in d.scores},
            metrics={s.skill: s.metrics or {} for s in d.scores},
        )
        for d in dives
    ]
    return compute_milestones(records, cfg.stop_target_s)


@router.get("", response_model=list[MilestoneOut])
def list_milestones(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return load_milestones(db, user)
