from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import Dive, User
from ..schemas import SettingsOut
from ..scoring import ScoringSettings
from ..scoring.store import ensure_scores, load_settings, save_settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cfg, version = load_settings(db, user.id)
    return SettingsOut(values=cfg, defaults=ScoringSettings(), version=version)


@router.put("", response_model=SettingsOut)
def put_settings(
    cfg: ScoringSettings, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    version = save_settings(db, user.id, cfg)
    db.commit()
    # Rescore now so the logbook reflects the new thresholds immediately
    dives = db.scalars(
        select(Dive).where(Dive.user_id == user.id).options(selectinload(Dive.scores))
    ).all()
    ensure_scores(db, user.id, list(dives))
    return SettingsOut(values=cfg, defaults=ScoringSettings(), version=version)
