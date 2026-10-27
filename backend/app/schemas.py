from datetime import datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from .scoring import ScoringSettings
from .scoring.difficulty import Grading


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
    site_id: int | None
    site_name: str | None
    overall_score: int | None
    scores: list[SkillScoreOut]
    # Repeat dives on the same day (app.dive_day)
    dive_of_day: int
    dives_that_day: int
    surface_interval_s: float | None  # None for the day's first dive
    previous_dive_id: int | None  # the day's dive before this one
    # From the notes, for grouping the logbook
    sea_life: list[str]
    buddy: str | None


class SampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    t_s: float
    depth_m: float
    temp_k: float | None
    heart_rate: int | None
    tank_pressure_bar: float | None
    ndl_s: int | None
    ceiling_m: float | None
    tts_s: int | None
    n2_load_pct: float | None
    cns_pct: float | None
    po2_bar: float | None


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


NOTE_TAG_MAX = 60
NOTE_TAGS_MAX = 40


def _clean_tags(tags: list[str]) -> list[str]:
    """Trimmed, single-spaced and de-duplicated ignoring case, in the order given."""
    out, seen = [], set()
    for tag in tags:
        tag = " ".join(tag.split())
        if tag and tag.casefold() not in seen:
            seen.add(tag.casefold())
            out.append(tag)
    return out


class NotesIn(BaseModel):
    feeling: int | None = Field(None, ge=1, le=5)  # 1 rough ... 5 great
    sea_life: list[str] = Field(default_factory=list, max_length=NOTE_TAGS_MAX)
    landmarks: list[str] = Field(default_factory=list, max_length=NOTE_TAGS_MAX)
    text: str = Field("", max_length=5000)
    # Conditions
    visibility_m: float | None = Field(None, ge=0, le=100)
    buddy: str | None = Field(None, max_length=80)

    @field_validator("buddy")
    @classmethod
    def _buddy(cls, v: str | None) -> str | None:
        return (v or "").strip() or None

    @field_validator("sea_life", "landmarks")
    @classmethod
    def _tags(cls, v: list[str]) -> list[str]:
        if any(len(t.strip()) > NOTE_TAG_MAX for t in v):
            raise ValueError(f"keep each entry to {NOTE_TAG_MAX} characters")
        return _clean_tags(v)

    @field_validator("text")
    @classmethod
    def _text(cls, v: str) -> str:
        return v.strip()


class NotesOut(NotesIn):
    model_config = ConfigDict(from_attributes=True)

    updated_at: datetime


Suit = Literal["none", "shorty", "3mm", "5mm", "7mm", "semidry", "drysuit"]


class GearIn(BaseModel):
    weight_kg: float | None = Field(None, ge=0, le=30)
    suit: Suit | None = None
    tank_material: Literal["aluminum", "steel"] | None = None


class GearOut(GearIn):
    model_config = ConfigDict(from_attributes=True)

    updated_at: datetime


class GearHistoryRow(BaseModel):
    """One dive with gear logged, for comparing weighting with buoyancy."""

    dive_id: int
    started_at: datetime
    site_name: str | None
    weight_kg: float | None
    suit: str | None
    tank_material: str | None
    buoyancy_score: int | None


class DebriefItem(BaseModel):
    kind: Literal["good", "work_on", "info"]
    skill: str | None  # ascent | stop | buoyancy | air, or None for the dive as a whole
    title: str
    detail: str
    at_s: float | None = None  # a moment on the profile to show


class Goal(BaseModel):
    """Last dive's focus, checked against this dive."""

    skill: str
    title: str
    status: Literal["met", "closer", "not_yet", "not_scored"]
    detail: str


class Debrief(BaseModel):
    headline: str
    goal: Goal | None = None
    focus: DebriefItem | None  # the one thing to work on next dive
    items: list[DebriefItem]


class ThermoclineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    top_m: float
    bottom_m: float
    above_k: float
    below_k: float


class MilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    title: str
    description: str
    earned_dive_id: int | None
    earned_at: datetime | None
    progress: int
    target: int


class NoteTags(BaseModel):
    """What the diver has noted before, most often first, for autocomplete."""

    sea_life: list[str]
    landmarks: list[str]


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
    notes: NotesOut | None
    gear: GearOut | None
    thermocline: ThermoclineOut | None
    debrief: Debrief
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
    # From the dives' notes, most often noted first
    sea_life: list[str]
    landmarks: list[str]


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


class NameSuggestion(BaseModel):
    name: str
    kind: str  # e.g. "Dive site", "Lake", "Reef"
    distance_m: int  # 0 when the site is inside it


class NameSuggestions(BaseModel):
    suggestions: list[NameSuggestion]
    # Set when the lookup service couldn't be reached; it's tried again next time
    error: str | None = None


class TrendPoint(BaseModel):
    id: int
    started_at: datetime
    site_id: int | None
    scores: dict[str, int | None]
    overall_score: int | None
    median_ascent_m_per_min: float | None
    max_ascent_m_per_min: float | None


class Headline(BaseModel):
    """A skill's average over the last HEADLINE_DIVES scored dives and the ones before."""

    skill: str  # a skill, or "overall"
    recent: int | None
    recent_dives: int
    previous: int | None
    previous_dives: int


class Trends(BaseModel):
    points: list[TrendPoint]  # oldest first
    headlines: list[Headline]
    window: int  # dives per headline period


class SettingsOut(BaseModel):
    values: ScoringSettings
    defaults: ScoringSettings
    version: int
    # What each difficulty costs, for the settings and how-scores-work pages
    grading: dict[str, Grading]
