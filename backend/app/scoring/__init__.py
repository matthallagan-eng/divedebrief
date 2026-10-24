"""Dive skill scoring. Bump ALGORITHM_VERSION whenever a score could change,
so stored scores are recomputed."""
from .air import AirInput, score_air
from .ascent_control import score_ascent
from .buoyancy import score_buoyancy
from .common import Profile, Region, SkillResult
from .safety_stop import score_stop
from .settings import ScoringSettings

ALGORITHM_VERSION = 2


def score_dive(times, depths, cfg: ScoringSettings) -> list[SkillResult]:
    p = Profile.from_samples(times, depths, cfg.ascent_window_s)
    return [score_ascent(p, cfg), score_stop(p, cfg), score_buoyancy(p, cfg)]


def overall_score(results: dict[str, int | None], cfg: ScoringSettings) -> int | None:
    """Weighted mean of the skills that have a score; None if none do."""
    weights = {
        "ascent": cfg.weight_ascent,
        "stop": cfg.weight_stop,
        "buoyancy": cfg.weight_buoyancy,
        "air": cfg.weight_air,
    }
    scored = [(s, weights.get(k, 0)) for k, s in results.items() if s is not None and weights.get(k, 0) > 0]
    total = sum(w for _, w in scored)
    if not total:
        return None
    return round(sum(s * w for s, w in scored) / total)


__all__ = [
    "ALGORITHM_VERSION", "AirInput", "Profile", "Region", "ScoringSettings", "SkillResult",
    "overall_score", "score_air", "score_dive",
]
