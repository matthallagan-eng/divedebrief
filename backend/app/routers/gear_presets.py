"""Gear presets: named kits the diver wears often, applied to a dive's gear
in one click."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import GearPreset, User
from ..schemas import GearPresetIn, GearPresetOut

router = APIRouter(prefix="/gear-presets", tags=["gear"])


def _own_preset(db: Session, preset_id: int, user: User) -> GearPreset:
    preset = db.get(GearPreset, preset_id)
    if preset is None or preset.user_id != user.id:
        raise HTTPException(404, "Kit not found")
    return preset


def _check_name_free(db: Session, user: User, name: str, preset_id: int | None = None) -> None:
    clash = db.scalar(select(GearPreset).where(GearPreset.user_id == user.id, GearPreset.name == name))
    if clash is not None and clash.id != preset_id:
        raise HTTPException(409, f"You already have a kit called {name}")


@router.get("", response_model=list[GearPresetOut])
def list_presets(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(
        select(GearPreset).where(GearPreset.user_id == user.id).order_by(GearPreset.created_at, GearPreset.id)
    ).all()


@router.post("", response_model=GearPresetOut, status_code=201)
def add_preset(body: GearPresetIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _check_name_free(db, user, body.name)
    preset = GearPreset(user_id=user.id, **body.model_dump())
    db.add(preset)
    db.commit()
    return preset


@router.put("/{preset_id}", response_model=GearPresetOut)
def update_preset(
    preset_id: int, body: GearPresetIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    preset = _own_preset(db, preset_id, user)
    _check_name_free(db, user, body.name, preset_id)
    for field, value in body.model_dump().items():
        setattr(preset, field, value)
    db.commit()
    return preset


@router.delete("/{preset_id}", status_code=204)
def delete_preset(preset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(_own_preset(db, preset_id, user))
    db.commit()
