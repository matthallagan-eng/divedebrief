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
    # Where the dive is placed on the map and grouped into a site: the entry
    # point, or the exit point when the watch had no fix at the start
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Surface GPS fixes from the FIT file; there is no GPS underwater
    entry_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    entry_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    exit_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    exit_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    site_id: Mapped[int | None] = mapped_column(
        ForeignKey("sites.id", ondelete="SET NULL"), index=True, nullable=True
    )

    upload: Mapped["Upload"] = relationship(back_populates="dives")
    site: Mapped["Site | None"] = relationship(back_populates="dives")
    samples: Mapped[list["Sample"]] = relationship(
        back_populates="dive",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Sample.t_s",
    )
    scores: Mapped[list["DiveScore"]] = relationship(
        back_populates="dive", cascade="all, delete-orphan", passive_deletes=True
    )
    tank: Mapped["DiveTank | None"] = relationship(
        back_populates="dive", cascade="all, delete-orphan", passive_deletes=True
    )
    notes: Mapped["DiveNotes | None"] = relationship(
        back_populates="dive", cascade="all, delete-orphan", passive_deletes=True
    )
    gear: Mapped["DiveGear | None"] = relationship(
        back_populates="dive", cascade="all, delete-orphan", passive_deletes=True
    )


class Site(Base):
    """Dives whose positions fall within app.sites.SITE_RADIUS_M of each other.
    Kept when its last dive is deleted, so a re-upload finds its name again."""

    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Mean position of the site's dives
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    # Set by the diver; overrides the water type the dive computer recorded
    water_type: Mapped[str | None] = mapped_column(String(8), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    # Names of dive sites and bodies of water nearby, from OpenStreetMap (app.places).
    # Fetched once, the first time the diver opens the site; None = not fetched yet.
    name_suggestions: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    dives: Mapped[list["Dive"]] = relationship(back_populates="site")


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
    ceiling_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    tts_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    n2_load_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    cns_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    po2_bar: Mapped[float | None] = mapped_column(Float, nullable=True)

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
    # Per-dive numbers for trends, e.g. median and fastest ascent rate
    metrics: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    algorithm_version: Mapped[int] = mapped_column(Integer)
    settings_version: Mapped[int] = mapped_column(Integer)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    dive: Mapped["Dive"] = relationship(back_populates="scores")


class DiveTank(Base):
    """The dive's tank, for air efficiency. Single gas, so one per dive."""

    __tablename__ = "dive_tanks"

    dive_id: Mapped[int] = mapped_column(
        ForeignKey("dives.id", ondelete="CASCADE"), primary_key=True
    )
    # Water volume in litres; the diver enters it even when pressures are sampled
    volume_l: Mapped[float | None] = mapped_column(Float, nullable=True)
    start_bar: Mapped[float] = mapped_column(Float)
    end_bar: Mapped[float] = mapped_column(Float)
    # sampled: pressures from the dive computer's transmitter; manual: entered
    source: Mapped[str] = mapped_column(String(8))

    dive: Mapped["Dive"] = relationship(back_populates="tank")


class DiveNotes(Base):
    """What the diver wrote about a dive."""

    __tablename__ = "dive_notes"

    dive_id: Mapped[int] = mapped_column(
        ForeignKey("dives.id", ondelete="CASCADE"), primary_key=True
    )
    # 1 (rough) to 5 (great)
    feeling: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sea_life: Mapped[list] = mapped_column(JSONB, default=list)
    landmarks: Mapped[list] = mapped_column(JSONB, default=list)
    text: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    dive: Mapped["Dive"] = relationship(back_populates="notes")


class DiveGear(Base):
    """What the diver wore, so weighting can be compared with buoyancy."""

    __tablename__ = "dive_gear"

    dive_id: Mapped[int] = mapped_column(
        ForeignKey("dives.id", ondelete="CASCADE"), primary_key=True
    )
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    # none | shorty | 3mm | 5mm | 7mm | semidry | drysuit
    suit: Mapped[str | None] = mapped_column(String(16), nullable=True)
    tank_material: Mapped[str | None] = mapped_column(String(16), nullable=True)  # aluminum | steel
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    dive: Mapped["Dive"] = relationship(back_populates="gear")
