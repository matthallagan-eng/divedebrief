from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import Dive, User
from ..schemas import DiveDetail, DiveSummary

router = APIRouter(prefix="/dives", tags=["dives"])


@router.get("", response_model=list[DiveSummary])
def list_dives(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(
        select(Dive).where(Dive.user_id == user.id).order_by(Dive.started_at.desc())
    ).all()


@router.get("/{dive_id}", response_model=DiveDetail)
def get_dive(dive_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dive = db.scalar(
        select(Dive)
        .where(Dive.id == dive_id, Dive.user_id == user.id)
        .options(selectinload(Dive.samples))
    )
    if dive is None:
        raise HTTPException(404, "Dive not found")
    return dive


@router.delete("/{dive_id}", status_code=204)
def delete_dive(dive_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dive = db.scalar(select(Dive).where(Dive.id == dive_id, Dive.user_id == user.id))
    if dive is None:
        raise HTTPException(404, "Dive not found")
    db.delete(dive)
    db.commit()
