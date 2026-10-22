from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..auth import create_access_token, hash_password, verify_password
from ..database import get_db
from ..deps import get_current_user
from ..models import Dive, Upload, User
from ..schemas import Token, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

# Compared against when the email is unknown, so login takes the same time
# whether or not an account exists
_DUMMY_HASH = hash_password("timing-equalizer")


def _normalize(email: str) -> str:
    return email.strip().lower()


@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    email = _normalize(payload.email)
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    is_first = db.scalar(select(User.id).limit(1)) is None
    user = User(email=email, hashed_password=hash_password(payload.password))
    db.add(user)
    db.flush()
    if is_first:
        # The first account inherits the logbook from before accounts existed
        for model in (Upload, Dive):
            db.execute(update(model).where(model.user_id.is_(None)).values(user_id=user.id))
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == _normalize(form.username)))
    hashed = user.hashed_password if user else _DUMMY_HASH
    if not verify_password(form.password, hashed) or user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
