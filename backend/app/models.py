from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Upload(Base):
    __tablename__ = "uploads"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Nullable only for V1 rows, which the first account to register claims
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    filename: Mapped[str] = mapped_column(String(255))
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    dives_added: Mapped[int] = mapped_column(Integer, default=0)
    dives_skipped: Mapped[int] = mapped_column(Integer, default=0)

    dives: Mapped[list["Dive"]] = relationship(
        back_populates="upload", cascade="all, delete-orphan", passive_deletes=True
    )


class Dive(Base):
    __tablename__ = "dives"
    __table_args__ = (UniqueConstraint("user_id", "fingerprint"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # Duplicates upload.user_id so dedupe can be unique per diver
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    upload_id: Mapped[int] = mapped_column(
        ForeignKey("uploads.id", ondelete="CASCADE"), index=True
    )
    # sha256 of start time + sample series; used to skip re-uploaded dives
    fingerprint: Mapped[str] = mapped_column(String(64))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    duration_s: Mapped[float] = mapped_column(Float)
    max_depth_m: Mapped[float] = mapped_column(Float)
    avg_depth_m: Mapped[float] = mapped_column(Float)
    min_temp_k: Mapped[float | None] = mapped_column(Float, nullable=True)
    computer_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    computer_serial: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ascent_violations: Mapped[int] = mapped_column(Integer, default=0)

    upload: Mapped["Upload"] = relationship(back_populates="dives")
    samples: Mapped[list["Sample"]] = relationship(
        back_populates="dive",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Sample.t_s",
    )


class Sample(Base):
    __tablename__ = "samples"

    dive_id: Mapped[int] = mapped_column(
        ForeignKey("dives.id", ondelete="CASCADE"), primary_key=True
    )
    t_s: Mapped[float] = mapped_column(Float, primary_key=True)
    depth_m: Mapped[float] = mapped_column(Float)
    temp_k: Mapped[float | None] = mapped_column(Float, nullable=True)

    dive: Mapped["Dive"] = relationship(back_populates="samples")
