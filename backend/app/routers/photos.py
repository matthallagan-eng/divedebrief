"""Photos from a dive. The images are private files (app.files)."""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import files
from ..database import get_db
from ..deps import get_current_user
from ..models import Dive, DivePhoto, User
from ..schemas import PhotoIn, PhotoOut

router = APIRouter(tags=["photos"])

KIND = "photos"
PER_DIVE = 30


def _own_dive(db: Session, dive_id: int, user: User) -> Dive:
    dive = db.scalar(select(Dive).where(Dive.id == dive_id, Dive.user_id == user.id))
    if dive is None:
        raise HTTPException(404, "Dive not found")
    return dive


def _own_photo(db: Session, photo_id: int, user: User) -> DivePhoto:
    photo = db.scalar(select(DivePhoto).join(Dive).where(DivePhoto.id == photo_id, Dive.user_id == user.id))
    if photo is None:
        raise HTTPException(404, "Photo not found")
    return photo


def photo_files(db: Session, dive_ids: list[int]) -> list[str]:
    """The files of these dives' photos, to remove once the dives are deleted."""
    if not dive_ids:
        return []
    return list(db.scalars(select(DivePhoto.file).where(DivePhoto.dive_id.in_(dive_ids))))


@router.get("/dives/{dive_id}/photos", response_model=list[PhotoOut])
def list_photos(dive_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _own_dive(db, dive_id, user).photos


@router.post("/dives/{dive_id}/photos", response_model=PhotoOut, status_code=201)
async def add_photo(
    dive_id: int,
    file: UploadFile = File(...),
    caption: str = Form("", max_length=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """A JPEG, PNG or WebP photo, with an optional caption."""
    dive = _own_dive(db, dive_id, user)
    count = db.scalar(select(func.count()).select_from(DivePhoto).where(DivePhoto.dive_id == dive.id))
    if count >= PER_DIVE:
        raise HTTPException(400, f"A dive can have up to {PER_DIVE} photos")
    name = await files.save(file, KIND, user.id, files.PHOTOS, "a JPEG, PNG or WebP photo")
    photo = DivePhoto(dive_id=dive.id, file=name, caption=caption.strip())
    db.add(photo)
    db.commit()
    return photo


@router.put("/photos/{photo_id}", response_model=PhotoOut)
def update_photo(photo_id: int, body: PhotoIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    photo = _own_photo(db, photo_id, user)
    photo.caption = body.caption
    db.commit()
    return photo


@router.delete("/photos/{photo_id}", status_code=204)
def delete_photo(photo_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    photo = _own_photo(db, photo_id, user)
    name = photo.file
    db.delete(photo)
    db.commit()
    files.remove(KIND, user.id, name)


@router.get("/photos/{photo_id}/file")
def get_photo(photo_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return files.serve(KIND, user.id, _own_photo(db, photo_id, user).file, "Photo not found")
