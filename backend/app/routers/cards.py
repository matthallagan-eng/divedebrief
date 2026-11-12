"""Certification cards, with a photo (or PDF) of each side.

The photos are files under settings.upload_dir/cards/<user id>/, given random
names; the database row names them. They're only served to their owner.
"""
import uuid
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..certs import LEVELS, sniff
from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..models import CertCard, User
from ..schemas import CardIn, CardOut

router = APIRouter(prefix="/cards", tags=["cards"])

Side = Literal["front", "back"]
MEDIA = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf"}


def _folder(user: User) -> Path:
    return Path(settings.upload_dir) / "cards" / str(user.id)


def _media(name: str | None) -> str | None:
    return MEDIA.get(Path(name).suffix) if name else None


def _out(card: CertCard) -> CardOut:
    return CardOut(
        id=card.id,
        agency=card.agency,
        level=card.level,
        level_label=LEVELS[card.level][0],
        title=card.title,
        number=card.number,
        certified_on=card.certified_on,
        front=_media(card.front_file),
        back=_media(card.back_file),
        created_at=card.created_at,
    )


def _own_card(db: Session, card_id: int, user: User) -> CertCard:
    card = db.get(CertCard, card_id)
    if card is None or card.user_id != user.id:
        raise HTTPException(404, "Card not found")
    return card


def _remove(user: User, name: str | None) -> None:
    if name:
        (_folder(user) / name).unlink(missing_ok=True)


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
    files = [card.front_file, card.back_file]
    db.delete(card)
    db.commit()
    for name in files:
        _remove(user, name)


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
    contents = await file.read(settings.max_upload_bytes + 1)
    if len(contents) > settings.max_upload_bytes:
        raise HTTPException(400, f"File too large (max {settings.max_upload_bytes // 2**20} MB)")
    kind = sniff(contents)
    if kind is None:
        raise HTTPException(400, "Use a JPEG, PNG or WebP photo, or a PDF")
    folder = _folder(user)
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{kind[1]}"
    # Written whole, then renamed into place, so a failed upload leaves no half file
    partial = folder / f"{name}.part"
    partial.write_bytes(contents)
    partial.replace(folder / name)
    old = getattr(card, f"{side}_file")
    setattr(card, f"{side}_file", name)
    db.commit()
    _remove(user, old)
    return _out(card)


@router.get("/{card_id}/{side}")
def get_photo(card_id: int, side: Side, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    card = _own_card(db, card_id, user)
    name = getattr(card, f"{side}_file")
    path = _folder(user) / name if name else None
    if path is None or not path.is_file():
        raise HTTPException(404, "No photo of that side")
    # Private: never kept by shared caches
    return FileResponse(path, media_type=_media(name), headers={"Cache-Control": "private, no-store"})


@router.delete("/{card_id}/{side}", response_model=CardOut)
def delete_photo(card_id: int, side: Side, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    card = _own_card(db, card_id, user)
    old = getattr(card, f"{side}_file")
    setattr(card, f"{side}_file", None)
    db.commit()
    _remove(user, old)
    return _out(card)
