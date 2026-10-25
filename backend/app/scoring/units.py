"""Numbers in score reasons, in the diver's units. Scores are always worked
out in metric; only the text changes.

Each formatter takes a format spec per system, since a metre and a foot need
different precision: metric keeps the specs the reasons have always used.
"""
from typing import Literal

Units = Literal["metric", "imperial"]

FT_PER_M = 3.28084
L_PER_CU_FT = 28.3168


def length(m: float, units: Units, metric: str = ".1f", imperial: str = ".0f") -> str:
    if units == "imperial":
        return f"{m * FT_PER_M:{imperial}} ft"
    return f"{m:{metric}} m"


def length_range(lo_m: float, hi_m: float, units: Units, metric: str = "g", imperial: str = ".0f") -> str:
    """'3 and 6 m', with the unit once."""
    if units == "imperial":
        return f"{lo_m * FT_PER_M:{imperial}} and {hi_m * FT_PER_M:{imperial}} ft"
    return f"{lo_m:{metric}} and {hi_m:{metric}} m"


def rate(m_per_min: float, units: Units, metric: str = ".0f", imperial: str = ".0f") -> str:
    if units == "imperial":
        return f"{m_per_min * FT_PER_M:{imperial}} ft/min"
    return f"{m_per_min:{metric}} m/min"


def sac(l_per_min: float, units: Units) -> str:
    if units == "imperial":
        return f"{l_per_min / L_PER_CU_FT:.2f} cu ft/min"
    return f"{l_per_min:.1f} L/min"
