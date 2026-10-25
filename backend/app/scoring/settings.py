from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .difficulty import Difficulty
from .units import Units


class ScoringSettings(BaseModel):
    """Per-diver scoring thresholds. Defaults come from docs/V2_SCOPE.md."""

    model_config = ConfigDict(extra="forbid")

    # Ascent control
    ascent_window_s: int = Field(10, ge=4, le=30)
    ascent_target_m_per_min: float = Field(9.0, ge=3, le=18)
    ascent_violation_m_per_min: float = Field(18.0, ge=6, le=30)
    ascent_final_zone_m: float = Field(6.0, ge=0, le=15)
    ascent_final_zone_weight: float = Field(2.0, ge=1, le=5)

    # Safety stop
    stop_band_min_m: float = Field(3.0, ge=1, le=10)
    stop_band_max_m: float = Field(6.0, ge=2, le=12)
    stop_tolerance_m: float = Field(0.5, ge=0, le=2)
    stop_target_s: int = Field(180, ge=30, le=600)
    stop_min_dive_depth_m: float = Field(10.0, ge=0, le=40)

    # Buoyancy stability
    buoyancy_detrend_window_s: int = Field(60, ge=20, le=300)
    buoyancy_excursion_m: float = Field(1.0, ge=0.3, le=3)

    # Air efficiency: used when the dive itself has no water type
    default_water_type: Literal["salt", "fresh"] = "salt"

    # How strictly every skill is graded (see difficulty.py); easy suits newer divers
    difficulty: Difficulty = "easy"
    # Units for score reasons and the whole app. Thresholds above stay metric.
    units: Units = "metric"

    # Overall score weights; a weight of 0 leaves the skill out
    weight_ascent: float = Field(1.0, ge=0, le=10)
    weight_stop: float = Field(1.0, ge=0, le=10)
    weight_buoyancy: float = Field(1.0, ge=0, le=10)
    weight_air: float = Field(1.0, ge=0, le=10)

    @model_validator(mode="after")
    def _ordered(self):
        if self.ascent_violation_m_per_min <= self.ascent_target_m_per_min:
            raise ValueError("ascent violation rate must be above the target rate")
        if self.stop_band_max_m <= self.stop_band_min_m:
            raise ValueError("safety stop band max must be deeper than band min")
        return self
