"""Certification cards, with a photo (or PDF) of each side.

The photos are private files (app.files); the database row names them.
"""
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import files
from ..certs import LEVELS
from ..database import get_db
from ..deps import get_current_user
from ..models import CertCard, User
from ..schemas import CardIn, CardOut

router = APIRouter(prefix="/cards", tags=["cards"])

Side = Literal["front", "back"]
KIND = "cards"


def _out(card: CertCard) -> CardOut:
    return CardOut(
        id=card.id,
        agency=card.agency,
        level=card.level,
        level_label=LEVELS[card.level][0],
        title=card.title,
        number=card.number,
        certified_on=card.certified_on,
        front=files.media(card.front_file),
        back=files.media(card.back_file),
        created_at=card.created_at,
    )


def _own_card(db: Session, card_id: int, user: User) -> CertCard:
    card = db.get(CertCard, card_id)
    if card is None or card.user_id != user.id:
        raise HTTPException(404, "Card not found")
    return card


@router.get("", response_model=list[CardOut])
def list_cards(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cards = db.scalars(select(CertCard).where(CertCard.user_id == user.id).order_by(CertCard.created_at)).all()
    # Oldest certification first; undated cards last, in the order they were added
    return [_out(c) for c in sorted(cards, key=lambda c: (c.certified_on is None, c.certified_on or c.created_at.date()))]


@router.post("", response_model=CardOut, status_code=201)
def add_card(body: CardIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    card = CertCard(user_id=user.id, **body.model_dump())
    db.add(card)
    db.commit()
    return _out(card)


@router.put("/{card_id}", response_model=CardOut)
def update_card(card_id: int, body: CardIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    card = _own_card(db, card_id, user)
    for field, value in body.model_dump().items():
        setattr(card, field, value)
    db.commit()
    return _out(card)


@router.delete("/{card_id}", status_code=204)
def delete_card(card_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    card = _own_card(db, card_id, user)
    names = [card.front_file, card.back_file]
    db.delete(card)
    db.commit()
    files.remove(KIND, user.id, *names)


@router.put("/{card_id}/{side}", response_model=CardOut)
async def put_photo(
    card_id: int,
    side: Side,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """A photo or scan of one side of the card: JPEG, PNG, WebP or PDF."""
    card = _own_card(db, card_id, user)
    name = await files.save(file, KIND, user.id, (*files.PHOTOS, "application/pdf"), "a JPEG, PNG or WebP photo, or a PDF")
    old = getattr(card, f"{side}_file")
    setattr(card, f"{side}_file", name)
    db.commit()
    files.remove(KIND, user.id, old)
    return _out(card)


@router.get("/{card_id}/{side}")
def get_photo(card_id: int, side: Side, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    card = _own_card(db, card_id, user)
    return files.serve(KIND, user.id, getattr(card, f"{side}_file"), "No photo of that side")


@router.delete("/{card_id}/{side}", response_model=CardOut)
def delete_photo(card_id: int, side: Side, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    card = _own_card(db, card_id, user)
    old = getattr(card, f"{side}_file")
    setattr(card, f"{side}_file", None)
    db.commit()
    files.remove(KIND, user.id, old)
    return _out(card)
