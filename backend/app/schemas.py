from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

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


class DiveDetail(DiveSummary):
    computer_serial: str | None
    source: str
    water_type: str | None
    latitude: float | None
    longitude: float | None
    scores: list[SkillScoreDetail]
    samples: list[SampleOut]
    # 1 s grid with smoothed ascent rate, for the charts
    profile: list[ProfilePoint]


class SettingsOut(BaseModel):
    values: ScoringSettings
    defaults: ScoringSettings
    version: int
