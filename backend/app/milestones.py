"""Skill milestones: badges earned across the diver's logbook, oldest dive
first. Each is earned on the first dive that reaches it; until then it shows
progress, e.g. 3 of 5 clean ascents in a row.

Score-based milestones follow the diver's current settings and difficulty,
so they're recomputed from stored scores on every read rather than stored.
"""
from dataclasses import dataclass
from datetime import datetime

DIVE_COUNTS = (1, 5, 10, 25, 50)
HOURS = (1, 5, 10)
SITES = 3
STREAK = 5
HIGH_SCORE = 90


@dataclass(frozen=True)
class DiveRecord:
    id: int
    started_at: datetime
    duration_s: float
    site_id: int | None
    overall: int | None
    scores: dict[str, int | None]
    regions: dict[str, list[dict]]
    metrics: dict[str, dict]


@dataclass(frozen=True)
class Milestone:
    key: str
    title: str
    description: str
    earned_dive_id: int | None
    earned_at: datetime | None
    progress: int  # toward target; equal to target once earned
    target: int


def compute_milestones(dives: list[DiveRecord], stop_target_s: int) -> list[Milestone]:
    dives = sorted(dives, key=lambda d: d.started_at)
    out: list[Milestone] = []

    def first(key, title, description, test):
        hit = next((d for d in dives if test(d)), None)
        out.append(Milestone(key, title, description, hit and hit.id, hit and hit.started_at, int(hit is not None), 1))

    def running(key, title, description, target, value):
        """value(dive) adds to a running total; earned when the total reaches target."""
        total = 0
        for d in dives:
            total += value(d)
            if total >= target:
                out.append(Milestone(key, title, description, d.id, d.started_at, target, target))
                return
        out.append(Milestone(key, title, description, None, None, int(total), target))

    def streak(key, title, description, applies, passes):
        """STREAK dives in a row that pass, counting only dives the skill applies to."""
        run = best = 0
        for d in dives:
            if not applies(d):
                continue
            run = run + 1 if passes(d) else 0
            best = max(best, run)
            if run >= STREAK:
                out.append(Milestone(key, title, description, d.id, d.started_at, STREAK, STREAK))
                return
        out.append(Milestone(key, title, description, None, None, best, STREAK))

    for n in DIVE_COUNTS:
        running(f"dives_{n}", "First dive logged" if n == 1 else f"{n} dives", f"Log {'your first dive' if n == 1 else f'{n} dives'}.", n, lambda d: 1)
    for h in HOURS:
        running(
            f"hours_{h}", f"{h} hour{'s' if h > 1 else ''} underwater", f"Spend {h} hour{'s' if h > 1 else ''} underwater in total.",
            h * 60, lambda d: d.duration_s / 60,
        )
    seen: set[int] = set()

    def new_site(d: DiveRecord) -> int:
        if d.site_id is None or d.site_id in seen:
            return 0
        seen.add(d.site_id)
        return 1

    running("sites_3", "Explorer", f"Dive {SITES} different sites.", SITES, new_site)

    def clean_ascent(d):
        return d.scores.get("ascent") is not None and not [
            r for r in d.regions.get("ascent", []) if r["severity"] in ("warning", "violation")
        ]

    first("clean_ascent", "Smooth ascent", "Every ascent on a dive under your target rate.", clean_ascent)
    streak(
        "clean_ascent_streak", "Ascent habit", f"{STREAK} dives in a row with every ascent under target.",
        lambda d: d.scores.get("ascent") is not None, clean_ascent,
    )
    first(
        "full_stop", "Full safety stop", "Hold a safety stop for the full target time.",
        lambda d: bool(d.scores.get("stop")) and d.metrics.get("stop", {}).get("held_s", 0) >= stop_target_s,
    )
    streak(
        "stop_streak", "Never skip the stop", f"{STREAK} dives in a row with a safety stop.",
        lambda d: d.scores.get("stop") is not None, lambda d: bool(d.scores.get("stop")),
    )
    first(
        "steady_bottom", "Steady as a rock", "A dive with no buoyancy excursions at the bottom.",
        lambda d: d.scores.get("buoyancy") is not None and d.metrics.get("buoyancy", {}).get("excursions") == 0,
    )
    first(
        "buoyancy_90", "Hover pro", f"Score {HIGH_SCORE} or more for buoyancy.",
        lambda d: (d.scores.get("buoyancy") or 0) >= HIGH_SCORE,
    )
    first("overall_90", "Dive of the day", f"Score {HIGH_SCORE} or more overall.", lambda d: (d.overall or 0) >= HIGH_SCORE)
    return out
