from datetime import datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from .scoring import ScoringSettings


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt uses the first 72 bytes


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UploadResult(BaseModel):
    # None when every dive in the file was already stored
    upload_id: int | None
    filename: str
    added: int
    # Dives already stored from UDDF that a FIT upload filled in
    updated: int = 0
    skipped: int
    warnings: list[str]


class UploadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    uploaded_at: datetime
    dives_added: int
    dives_skipped: int


class RegionOut(BaseModel):
    start_s: float
    end_s: float
    label: str
    severity: str


class SkillScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    skill: str
    score: int | None  # None = N/A, explained by reason
    reason: str


class SkillScoreDetail(SkillScoreOut):
    regions: list[RegionOut]


class DiveSummary(BaseModel):
    id: int
    upload_id: int
    started_at: datetime
    duration_s: float
    max_depth_m: float
    avg_depth_m: float
    min_temp_k: float | None
    computer_model: str | None
    overall_score: int | None
    scores: list[SkillScoreOut]


class SampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    t_s: float
    depth_m: float
    temp_k: float | None
    heart_rate: int | None
    tank_pressure_bar: float | None
    ndl_s: int | None


class ProfilePoint(BaseModel):
    t_s: float
    depth_m: float
    rate_m_per_min: float


class TankIn(BaseModel):
    volume_l: float = Field(ge=1, le=30)
    # May be left out when the dive computer recorded the pressures
    start_bar: float | None = Field(None, gt=0, le=350)
    end_bar: float | None = Field(None, ge=0, le=350)

    @model_validator(mode="after")
    def _used_air(self):
        if (self.start_bar is None) != (self.end_bar is None):
            raise ValueError("give both start and end pressure, or neither")
        if self.start_bar is not None and self.end_bar >= self.start_bar:
            raise ValueError("end pressure must be below start pressure")
        return self


class TankOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    volume_l: float | None
    start_bar: float
    end_bar: float
    source: str  # sampled | manual


class SiteRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str | None  # None until the diver names it
    latitude: float
    longitude: float
    water_type: str | None  # set by the diver; None = use the dive computer's


class DiveDetail(DiveSummary):
    computer_serial: str | None
    source: str
    tank: TankOut | None
    water_type: str | None
    latitude: float | None
    longitude: float | None
    entry_latitude: float | None
    entry_longitude: float | None
    exit_latitude: float | None
    exit_longitude: float | None
    site: SiteRef | None
    scores: list[SkillScoreDetail]
    samples: list[SampleOut]
    # 1 s grid with smoothed ascent rate, for the charts
    profile: list[ProfilePoint]


class MapDive(BaseModel):
    """A dive as the map shows it: where it was, and how it went."""

    id: int
    started_at: datetime
    duration_s: float
    max_depth_m: float
    overall_score: int | None
    latitude: float | None
    longitude: float | None
    entry_latitude: float | None
    entry_longitude: float | None
    exit_latitude: float | None
    exit_longitude: float | None


class SiteOut(SiteRef):
    # Mean of each skill's scores at this site, leaving out N/A; None if all N/A
    average_scores: dict[str, int | None]
    average_overall: int | None
    dives: list[MapDive]  # newest first


class DiveMap(BaseModel):
    sites: list[SiteOut]  # only sites that still have dives
    unknown: list[MapDive]  # dives without a GPS position


class SiteIn(BaseModel):
    name: str | None = Field(None, max_length=120)
    water_type: Literal["salt", "fresh"] | None = None

    @field_validator("name")
    @classmethod
    def _blank_is_unnamed(cls, v: str | None) -> str | None:
        return (v or "").strip() or None


class SettingsOut(BaseModel):
    values: ScoringSettings
    defaults: ScoringSettings
    version: int
