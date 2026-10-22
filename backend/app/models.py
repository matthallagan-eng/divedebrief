from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Float, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
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
    # sha256 of the start time; used to skip re-uploaded dives, from any format
    fingerprint: Mapped[str] = mapped_column(String(64))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    duration_s: Mapped[float] = mapped_column(Float)
    max_depth_m: Mapped[float] = mapped_column(Float)
    avg_depth_m: Mapped[float] = mapped_column(Float)
    min_temp_k: Mapped[float | None] = mapped_column(Float, nullable=True)
    computer_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    computer_serial: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Format the samples came from: uddf | fit. A FIT upload of a dive stored
    # from UDDF replaces its samples, since FIT is the watch's own recording.
    source: Mapped[str] = mapped_column(String(8), default="uddf", server_default="uddf")
    water_type: Mapped[str | None] = mapped_column(String(8), nullable=True)  # salt | fresh
    # GPS start point, or the exit point when the watch had no fix at the start
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    upload: Mapped["Upload"] = relationship(back_populates="dives")
    samples: Mapped[list["Sample"]] = relationship(
        back_populates="dive",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Sample.t_s",
    )
    scores: Mapped[list["DiveScore"]] = relationship(
        back_populates="dive", cascade="all, delete-orphan", passive_deletes=True
    )


class Sample(Base):
    __tablename__ = "samples"

    dive_id: Mapped[int] = mapped_column(
        ForeignKey("dives.id", ondelete="CASCADE"), primary_key=True
    )
    t_s: Mapped[float] = mapped_column(Float, primary_key=True)
    depth_m: Mapped[float] = mapped_column(Float)
    temp_k: Mapped[float | None] = mapped_column(Float, nullable=True)
    heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tank_pressure_bar: Mapped[float | None] = mapped_column(Float, nullable=True)
    ndl_s: Mapped[int | None] = mapped_column(Integer, nullable=True)

    dive: Mapped["Dive"] = relationship(back_populates="samples")


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # app.scoring.ScoringSettings as JSON; missing keys take the defaults
    data: Mapped[dict] = mapped_column(JSONB, default=dict)
    # Bumped on every change so stored scores know they're stale
    version: Mapped[int] = mapped_column(Integer, default=1)


class DiveScore(Base):
    __tablename__ = "dive_scores"

    dive_id: Mapped[int] = mapped_column(
        ForeignKey("dives.id", ondelete="CASCADE"), primary_key=True
    )
    skill: Mapped[str] = mapped_column(String(32), primary_key=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reason: Mapped[str] = mapped_column(Text)
    regions: Mapped[list] = mapped_column(JSONB, default=list)
    algorithm_version: Mapped[int] = mapped_column(Integer)
    settings_version: Mapped[int] = mapped_column(Integer)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    dive: Mapped["Dive"] = relationship(back_populates="scores")
