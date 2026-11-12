"""The instructor-style debrief: plain-language notes on a dive, written from
its scores and profile by fixed rules (no AI), in the diver's units.

Each skill gives at most one "work on" item and otherwise a "good" one, with
the moment on the profile it's about. The focus for next dive is the work-on
item of the lowest-scoring skill, and becomes the goal checked on the next
dive: met when that skill has nothing left to work on, closer when its score
rose by GOAL_CLOSER points. Comparisons use the diver's previous dive,
including what they wore, so weighting changes show up next to buoyancy.
"""
from dataclasses import dataclass

from .analysis.thermocline import Thermocline
from .dive_day import DayPlace
from .achievements import Creature
from .scoring import Profile, ScoringSettings
from .scoring import units as u
from .scoring.common import fmt_mmss
from .scoring.difficulty import GRADING
from .schemas import Debrief, DebriefItem, Goal

OPEN_WATER_LIMIT_M = 18.0
NDL_TIGHT_S = 5 * 60
SKILL_LABELS = {"ascent": "ascent control", "stop": "safety stop", "buoyancy": "buoyancy", "air": "air efficiency"}
SUIT_LABELS = {
    "none": "no suit", "shorty": "a shorty", "3mm": "a 3 mm wetsuit", "5mm": "a 5 mm wetsuit",
    "7mm": "a 7 mm wetsuit", "semidry": "a semidry", "drysuit": "a drysuit",
}
KG_PER_LB = 0.453592
CHANGE_WORTH_NOTING = 10  # score points between dives
GOAL_CLOSER = 5
KELVIN = 273.15
# Rest at least this long between dives, so more of the first dive's nitrogen is gone
SHORT_INTERVAL_S = 60 * 60
# A repeat dive this much deeper than the one before it is a reverse profile
DEEPER_THAN_BEFORE_M = 2.0
ORDINALS = {2: "second", 3: "third", 4: "fourth", 5: "fifth"}


@dataclass(frozen=True)
class ScoreView:
    score: int | None
    regions: list[dict]
    metrics: dict


@dataclass(frozen=True)
class GearView:
    weight_kg: float | None
    suit: str | None


@dataclass(frozen=True)
class PreviousDive:
    scores: dict[str, int | None]
    gear: GearView | None
    focus: DebriefItem | None = None  # its debrief's focus: this dive's goal


def weight(kg: float, units: str) -> str:
    if units == "imperial":
        return f"{kg / KG_PER_LB:.0f} lb"
    return f"{kg:g} kg"


def build_debrief(
    p: Profile,
    scores: dict[str, ScoreView],
    cfg: ScoringSettings,
    ndl_s: list[int],
    has_tank: bool,
    gear: GearView | None,
    previous: PreviousDive | None,
    thermocline: Thermocline | None = None,
    new_creatures: list[Creature] = (),
    day: DayPlace | None = None,
) -> Debrief:
    units = cfg.units
    items: list[DebriefItem] = []
    work_on: dict[str, DebriefItem] = {}

    def add(item: DebriefItem):
        items.append(item)
        if item.kind == "work_on" and item.skill:
            work_on.setdefault(item.skill, item)

    for build in (_ascent, _stop, _buoyancy):
        for item in build(p, scores, cfg):
            add(item)
    items += _weighting(scores, gear, previous, units)
    items += _limits(p, ndl_s, units)
    if day and day.surface_interval_s is not None:
        items += _repeat_dive(p, day, units)
    if not has_tank:
        items.append(DebriefItem(
            kind="info", skill="air", title="Track your air",
            detail="Add your tank size and start and end pressures in the Gear tab to see how efficiently you breathe.",
        ))
    if thermocline:
        items.append(_thermocline(thermocline, units))
    if previous:
        items += _compared(scores, previous)
    for c in new_creatures:
        items.append(DebriefItem(
            kind="good", skill=None, title=f"New creature: {c.name}",
            detail=f"{c.goal} It's swimming in your ocean now.",
        ))

    scored = [(v.score, k) for k, v in scores.items() if v.score is not None and k in work_on]
    focus = work_on[min(scored)[1]] if scored else None
    goal = previous and previous.focus and _goal(previous.focus, scores, items, work_on, previous)
    return Debrief(headline=_headline(scores, cfg, focus), goal=goal, focus=focus, items=items)


def _goal(
    focus: DebriefItem, scores: dict[str, ScoreView], items: list[DebriefItem],
    work_on: dict[str, DebriefItem], previous: PreviousDive,
) -> Goal:
    skill = focus.skill
    now, before = (scores.get(skill).score if scores.get(skill) else None), previous.scores.get(skill)
    name = SKILL_LABELS[skill]
    if now is None:
        return Goal(skill=skill, title=focus.title, status="not_scored",
                    detail=f"This dive couldn't score {name}, so the goal carries on to your next one.")
    change = f" ({before} → {now})" if before is not None else ""
    if skill not in work_on:
        praise = next((i.detail for i in items if i.skill == skill and i.kind == "good"), "")
        return Goal(skill=skill, title=focus.title, status="met",
                    detail=f"Nailed it{change}. {praise}".strip())
    if before is not None and now - before >= GOAL_CLOSER:
        return Goal(skill=skill, title=focus.title, status="closer",
                    detail=f"Getting there: {name} went from {before} to {now}. Keep at it.")
    return Goal(skill=skill, title=focus.title, status="not_yet",
                detail=f"Not yet{change}. It's still worth working on; see below.")


def _thermocline(th: Thermocline, units: str) -> DebriefItem:
    def temp(k: float) -> str:
        c = k - KELVIN
        return f"{c * 9 / 5 + 32:.0f} °F" if units == "imperial" else f"{c:.0f} °C"

    return DebriefItem(
        kind="info", skill=None, title="Thermocline",
        detail=(
            f"The water got colder between about {u.length(th.top_m, units)} and "
            f"{u.length(th.bottom_m, units)}, from {temp(th.above_k)} to {temp(th.below_k)}. "
            "Expect it there next time you dive this site, and dress for the colder water below."
        ),
    )


def _headline(scores: dict[str, ScoreView], cfg: ScoringSettings, focus: DebriefItem | None) -> str:
    values = [v.score for v in scores.values() if v.score is not None]
    if not values:
        return "Not enough of this dive could be scored for a debrief."
    low = min(values)
    if focus is None or low >= 85:
        return "A great dive. Keep doing what you did."
    if low >= 60:
        return f"A good dive. One thing to sharpen next time: {focus.title.lower()}."
    return f"Plenty to take away. Start with this: {focus.title.lower()}."


def _ascent(p: Profile, scores: dict[str, ScoreView], cfg: ScoringSettings) -> list[DebriefItem]:
    s = scores.get("ascent")
    if s is None or s.score is None:
        return []
    units = cfg.units
    target = u.rate(cfg.ascent_target_m_per_min, units, "g")
    over = [r for r in s.regions if r["severity"] in ("warning", "violation")]
    if not over:
        fastest = s.metrics.get("max_ascent_m_per_min")
        detail = f"Every ascent stayed under your {target} target"
        detail += f"; the fastest was {u.rate(fastest, units, '.1f')}." if fastest else "."
        return [DebriefItem(kind="good", skill="ascent", title="Slow, controlled ascents", detail=detail)]

    def peak(r):
        return max((rate for t, rate in zip(p.t, p.rate) if r["start_s"] <= t <= r["end_s"]), default=0.0)

    worst = max(over, key=peak)
    a, b = (_index(p, worst["start_s"]), _index(p, worst["end_s"]))
    top, bottom = p.depth[b], p.depth[a]
    detail = (
        f"At {fmt_mmss(worst['start_s'])} you rose at {u.rate(peak(worst), units)} from "
        f"{u.length(bottom, units, '.0f')} to {u.length(top, units, '.0f')}, over your {target} target"
    )
    detail += (
        f" and the {u.rate(cfg.ascent_violation_m_per_min, units, 'g')} limit." if worst["severity"] == "violation" else "."
    )
    if len(over) > 1:
        detail += f" It was the fastest of {len(over)} stretches over target."
    detail += (
        " Rise no faster than your smallest bubbles: let a little air out of your BCD before you start up, "
        "and keep venting in small puffs on the way."
    )
    if top <= cfg.ascent_final_zone_m:
        detail += (
            f" Take extra care in the last {u.length(cfg.ascent_final_zone_m, units, 'g')}, where the air in "
            "your BCD expands fastest."
        )
    return [DebriefItem(kind="work_on", skill="ascent", title="Slow your ascents", detail=detail, at_s=worst["start_s"])]


def _stop(p: Profile, scores: dict[str, ScoreView], cfg: ScoringSettings) -> list[DebriefItem]:
    s = scores.get("stop")
    if s is None:
        return []
    units = cfg.units
    band = u.length_range(cfg.stop_band_min_m, cfg.stop_band_max_m, units)
    if s.score is None:
        return [DebriefItem(
            kind="info", skill="stop", title="Safety stop not needed",
            detail="This dive was too shallow to need one, but stopping for 3 minutes anyway builds the habit.",
        )]
    if s.score == 0:
        return [DebriefItem(
            kind="work_on", skill="stop", title="Make a safety stop",
            detail=(
                f"No stop was found between {band} before you surfaced. At the end of every dive, hold between "
                f"{band} for {fmt_mmss(cfg.stop_target_s)} before going up."
            ),
        )]
    m = s.metrics
    start = s.regions[0]["start_s"] if s.regions else None
    held, target = m.get("held_s", 0), cfg.stop_target_s
    exits = m.get("exits", 0)
    drift = m.get("deepest_m", 0) - m.get("shallowest_m", 0)
    allowance = GRADING[cfg.difficulty].stop_drift_allowance_m
    if exits >= 2 or drift > allowance:
        detail = (
            f"You drifted between {u.length(m['shallowest_m'], units)} and {u.length(m['deepest_m'], units)}"
            + (f" and left the stop band {exits} time{'s' if exits != 1 else ''}." if exits else ".")
            + " At the stop, fine-tune with your breathing instead of your BCD: a longer breath out to sink a "
            "little, a fuller breath in to rise. Glance at your depth every few breaths."
        )
        return [DebriefItem(kind="work_on", skill="stop", title="Hold a steadier stop", detail=detail, at_s=start)]
    if held < target:
        return [DebriefItem(
            kind="work_on", skill="stop", title=f"Stay the full {fmt_mmss(target)}",
            detail=(
                f"You held your stop for {fmt_mmss(held)}. Start your computer's stop timer, or note the time, "
                "as soon as you reach the stop depth."
            ),
            at_s=start,
        )]
    return [DebriefItem(
        kind="good", skill="stop", title="Solid safety stop",
        detail=f"You held {fmt_mmss(held)} and stayed in the band.", at_s=start,
    )]


def _buoyancy(p: Profile, scores: dict[str, ScoreView], cfg: ScoringSettings) -> list[DebriefItem]:
    s = scores.get("buoyancy")
    if s is None or s.score is None:
        return []
    units = cfg.units
    m = s.metrics
    excursions = [r for r in s.regions if r["severity"] == "warning"]
    good_wobble = GRADING[cfg.difficulty].buoyancy_wobble_good_m
    if excursions:
        # The biggest one, measured from the depth just before it
        def size(r):
            a, b = _index(p, r["start_s"]), _index(p, r["end_s"])
            before = p.depth[max(0, a - 10)]
            off = [d - before for d in p.depth[a : b + 1]]
            return max(off, key=abs, default=0.0)

        worst = max(excursions, key=lambda r: abs(size(r)))
        off = size(worst)
        minutes = round(m.get("bottom_s", 0) / 60)
        detail = (
            f"At {fmt_mmss(worst['start_s'])} you {'sank' if off > 0 else 'rose'} about "
            f"{u.length(abs(off), units)} off your level"
        )
        n = len(excursions)
        detail += f", one of {n} excursions in {minutes} minutes at the bottom." if n > 1 else "."
        detail += (
            " Make small changes: one short puff of air in or out, then wait a few seconds for it to take effect "
            "before adding more."
        )
        return [DebriefItem(kind="work_on", skill="buoyancy", title="Hold your level", detail=detail, at_s=worst["start_s"])]
    wobble = m.get("wobble_m", 0)
    if wobble > good_wobble:
        return [DebriefItem(
            kind="work_on", skill="buoyancy", title="Settle your hover",
            detail=(
                f"No big excursions, but your depth wobbled by about ±{u.length(wobble, units, imperial='.1f')}. "
                "Breathe slowly and fully, keep your fins still, and let your breathing do the fine control."
            ),
        )]
    return [DebriefItem(
        kind="good", skill="buoyancy", title="Steady buoyancy",
        detail=f"You held your level within ±{u.length(wobble, units, imperial='.1f')} with no excursions.",
    )]


def _weighting(
    scores: dict[str, ScoreView], gear: GearView | None, previous: PreviousDive | None, units: str
) -> list[DebriefItem]:
    b = scores.get("buoyancy")
    score = b.score if b else None
    if gear is None or gear.weight_kg is None:
        if score is not None and score < 70:
            return [DebriefItem(
                kind="info", skill="buoyancy", title="Log your weights",
                detail=(
                    "Weighting is the most common cause of buoyancy trouble. Add what you wore in the Gear tab and "
                    "the debrief will compare it with your buoyancy from dive to dive."
                ),
            )]
        return []
    prev = previous.gear if previous else None
    prev_score = previous.scores.get("buoyancy") if previous else None
    if prev is None or prev.weight_kg is None or score is None or prev_score is None:
        return []
    if prev.weight_kg == gear.weight_kg:
        return []
    same_suit = prev.suit == gear.suit
    change = "more" if gear.weight_kg > prev.weight_kg else "less"
    detail = (
        f"You wore {weight(gear.weight_kg, units)} this dive, {weight(abs(gear.weight_kg - prev.weight_kg), units)} "
        f"{change} than last time, and your buoyancy scored {score} against {prev_score}."
    )
    if not same_suit:
        detail += (
            f" You also switched from {SUIT_LABELS.get(prev.suit or '', 'a different suit')} to "
            f"{SUIT_LABELS.get(gear.suit or '', 'a different suit')}, which changes how much weight you need."
        )
    elif score > prev_score:
        detail += f" The {change} weight may have helped; a few more dives will tell."
    elif score < prev_score:
        detail += " Your earlier weight may have suited you better; a few more dives will tell."
    detail += " Check your weighting at the surface near the end of a dive: with an empty BCD and a normal breath, you should float at eye level."
    return [DebriefItem(kind="info", skill="buoyancy", title="Weighting", detail=detail)]


def _limits(p: Profile, ndl_s: list[int], units: str) -> list[DebriefItem]:
    out = []
    deepest = max(p.depth, default=0.0)
    if deepest > OPEN_WATER_LIMIT_M:
        out.append(DebriefItem(
            kind="work_on", skill=None, title="Mind your depth limit",
            detail=(
                f"You reached {u.length(deepest, units)}, deeper than the {u.length(OPEN_WATER_LIMIT_M, units, 'g')} "
                "Open Water limit. Stay within your training until you've done deeper training."
            ),
            at_s=p.t[p.depth.index(deepest)],
        ))
    if ndl_s:
        low = min(ndl_s)
        if low <= NDL_TIGHT_S:
            out.append(DebriefItem(
                kind="work_on", skill=None, title="Keep more no-stop time",
                detail=(
                    f"Your no-decompression time dropped to {round(low / 60)} min. Start up, or move shallower, "
                    "before it gets that close."
                ),
            ))
        else:
            out.append(DebriefItem(
                kind="good", skill=None, title="Plenty of no-stop time",
                detail=f"Your no-decompression limit never dropped below {round(low / 60)} min.",
            ))
    return out


def fmt_interval(seconds: float) -> str:
    h, m = divmod(round(seconds / 60), 60)
    return f"{h} h {m} min" if h else f"{m} min"


def _repeat_dive(p: Profile, day: DayPlace, units: str) -> list[DebriefItem]:
    nth = ORDINALS.get(day.dive_of_day, f"{day.dive_of_day}th")
    interval = fmt_interval(day.surface_interval_s)
    if day.surface_interval_s < SHORT_INTERVAL_S:
        out = [DebriefItem(
            kind="work_on", skill=None, title="Take a longer surface interval",
            detail=(
                f"Your {nth} dive of the day began only {interval} after the last one ended. Aim for at least "
                f"{fmt_interval(SHORT_INTERVAL_S)} between dives: more of the nitrogen from the earlier dive leaves "
                "your body, and you get time to rest, drink water and plan."
            ),
        )]
    else:
        out = [DebriefItem(
            kind="info", skill=None, title=f"Your {nth} dive of the day",
            detail=(
                f"You had {interval} at the surface first. Your computer counts the nitrogen left from the earlier "
                "dive, so expect less no-stop time than on a first dive."
            ),
        )]
    deepest = max(p.depth, default=0.0)
    before = day.previous_max_depth_m
    if before is not None and deepest - before >= DEEPER_THAN_BEFORE_M:
        out.append(DebriefItem(
            kind="info", skill=None, title="Deepest dive first",
            detail=(
                f"This dive reached {u.length(deepest, units)}, deeper than the {u.length(before, units)} of your "
                "dive before it. Plan the day's deepest dive first and go shallower on each one after, since later "
                "dives start with nitrogen already in your body."
            ),
            at_s=p.t[p.depth.index(deepest)],
        ))
    return out


def _compared(scores: dict[str, ScoreView], previous: PreviousDive) -> list[DebriefItem]:
    better, worse = [], []
    for skill, view in scores.items():
        before = previous.scores.get(skill)
        if view.score is None or before is None:
            continue
        if view.score - before >= CHANGE_WORTH_NOTING:
            better.append(f"{SKILL_LABELS[skill]} ({before} → {view.score})")
        elif before - view.score >= CHANGE_WORTH_NOTING:
            worse.append(f"{SKILL_LABELS[skill]} ({before} → {view.score})")
    out = []
    if better:
        out.append(DebriefItem(
            kind="good", skill=None, title="Better than last dive",
            detail="Up since your previous dive: " + ", ".join(better) + ".",
        ))
    if worse:
        out.append(DebriefItem(
            kind="info", skill=None, title="Down from last dive",
            detail="Lower than your previous dive: " + ", ".join(worse) + ". One dive is noise; watch the trend in Habits.",
        ))
    return out


def _index(p: Profile, t: float) -> int:
    """Index of the grid second at or after t."""
    return next((i for i, x in enumerate(p.t) if x >= t), len(p.t) - 1)
