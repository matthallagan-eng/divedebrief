from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UploadResult(BaseModel):
    # None when every dive in the file was already stored
    upload_id: int | None
    filename: str
    added: int
    skipped: int
    warnings: list[str]


class UploadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    uploaded_at: datetime
    dives_added: int
    dives_skipped: int


class DiveSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    upload_id: int
    started_at: datetime
    duration_s: float
    max_depth_m: float
    avg_depth_m: float
    min_temp_k: float | None
    computer_model: str | None
    ascent_violations: int


class SampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    t_s: float
    depth_m: float
    temp_k: float | None


class DiveDetail(DiveSummary):
    computer_serial: str | None
    samples: list[SampleOut]
