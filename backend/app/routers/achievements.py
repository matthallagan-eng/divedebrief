from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from ..achievements import BY_KEY, CREATURES, DiveFacts, compute_achievements
from ..analysis.thermocline import find_thermocline
from ..certs import CardFacts
from ..config import settings
from ..database import get_db
from ..debrief import ScoreView, build_debrief
from ..deps import get_current_user
from ..dive_day import place_in_day
from ..models import AchievementSeen, CertCard, Dive, Sample, User
from ..schemas import AchievementOut, Achievements, SeenIn
from ..scoring import Profile, ScoringSettings, overall_score
from ..scoring.difficulty import GRADING
from ..scoring.store import ensure_scores
from ..sun import is_night

router = APIRouter(prefix="/achievements", tags=["achievements"])


def _solid_stop(dive: Dive, cfg: ScoringSettings) -> bool:
    """The debrief's "Solid safety stop": the full time, without drifting off."""
    stop = next((s for s in dive.scores if s.skill == "stop"), None)
    if stop is None or not stop.score:
        return False
    m = stop.metrics or {}
    drift = m.get("deepest_m", 0) - m.get("shallowest_m", 0)
    return (
        m.get("held_s", 0) >= cfg.stop_target_s
        and m.get("exits", 0) < 2
        and drift <= GRADING[cfg.difficulty].stop_drift_allowance_m
    )


def load_facts(db: Session, user: User) -> tuple[list[DiveFacts], ScoringSettings]:
    dives = db.scalars(
        select(Dive)
        .where(Dive.user_id == user.id)
        .options(selectinload(Dive.scores), selectinload(Dive.site), selectinload(Dive.notes), selectinload(Dive.gear))
        .order_by(Dive.started_at)
    ).all()
    cfg = ensure_scores(db, user.id, list(dives))
    # Just the columns the profile and thermocline need, for every dive at once
    samples: dict[int, list] = {d.id: [] for d in dives}
    for row in db.execute(
        select(Sample.dive_id, Sample.t_s, Sample.depth_m, Sample.temp_k)
        .join(Dive)
        .where(Dive.user_id == user.id)
        .order_by(Sample.dive_id, Sample.t_s)
    ):
        samples[row.dive_id].append(row)
    days = place_in_day(dives)

    facts, previous_focus = [], None
    for d in dives:
        rows = samples[d.id]
        t, depth = [r.t_s for r in rows], [r.depth_m for r in rows]
        views = {s.skill: ScoreView(s.score, s.regions, s.metrics or {}) for s in d.scores}
        debrief = build_debrief(Profile.from_samples(t, depth, cfg.ascent_window_s), views, cfg, [], True, None, None)
        work_on = {i.skill for i in debrief.items if i.kind == "work_on"}
        # As the debrief's goal check: the previous dive's focus has nothing left to work on
        skill = previous_focus and previous_focus.skill
        goal_met = bool(skill) and views.get(skill) is not None and views[skill].score is not None and skill not in work_on
        previous_focus = debrief.focus
        notes, gear = d.notes, d.gear
        facts.append(DiveFacts(
            id=d.id,
            started_at=d.started_at,
            duration_s=d.duration_s,
            max_depth_m=d.max_depth_m,
            site_id=d.site_id,
            site_named=bool(d.site and d.site.name),
            overall=overall_score({s.skill: s.score for s in d.scores}, cfg),
            scores={s.skill: s.score for s in d.scores},
            regions={s.skill: s.regions for s in d.scores},
            metrics={s.skill: s.metrics or {} for s in d.scores},
            water_type=(d.site and d.site.water_type) or d.water_type,
            min_temp_k=d.min_temp_k,
            latitude=d.latitude,
            has_notes=bool(notes and (notes.text or notes.feeling)),
            sea_life=notes.sea_life if notes else [],
            landmarks=notes.landmarks if notes else [],
            buddy=notes and notes.buddy,
            weight_logged=bool(gear and gear.weight_kg is not None),
            thermocline=find_thermocline(t, depth, [r.temp_k for r in rows]) is not None,
            goal_met=goal_met,
            repeat=days[d.id].dive_of_day > 1,
            night=is_night(d.started_at, d.latitude, d.longitude),
            solid_stop=_solid_stop(d, cfg),
        ))
    return facts, cfg


@router.get("", response_model=Achievements)
def list_achievements(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    facts, cfg = load_facts(db, user)
    cards = [
        CardFacts(c.level, c.certified_on, c.created_at)
        for c in db.scalars(select(CertCard).where(CertCard.user_id == user.id))
    ]
    progress = compute_achievements(facts, cfg.stop_target_s, cards)
    seen = set(db.scalars(select(AchievementSeen.key).where(AchievementSeen.user_id == user.id)))
    out = []
    for c in CREATURES:
        p = progress[c.key]
        # A locked creature's name is part of the surprise, so it isn't sent
        out.append(AchievementOut(
            key=c.key,
            name=c.name if p.earned else "???",
            preview_name=c.name if settings.achievement_test_mode else None,
            tier=c.tier,
            goal="A secret. Keep diving." if c.secret and not p.earned else c.goal,
            coming_soon=c.coming_soon,
            secret=c.secret,
            earned_dive_id=p.earned_dive_id,
            earned_at=p.earned_at,
            progress=p.progress,
            target=p.target,
            seen=c.key in seen,
        ))
    return Achievements(achievements=out, first_reveal=not seen, test_mode=settings.achievement_test_mode)


@router.post("/seen", status_code=204)
def mark_seen(body: SeenIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Record that the diver has seen these reveals."""
    seen = set(db.scalars(select(AchievementSeen.key).where(AchievementSeen.user_id == user.id)))
    for key in set(body.keys) - seen:
        if key in BY_KEY:
            db.add(AchievementSeen(user_id=user.id, key=key))
    db.commit()


# TEMPORARY test mode: remove with Settings.achievement_test_mode
@router.post("/test/reset-seen", status_code=204)
def reset_seen(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Forget which reveals were seen, so they play again."""
    if not settings.achievement_test_mode:
        raise HTTPException(404, "Not found")
    db.execute(delete(AchievementSeen).where(AchievementSeen.user_id == user.id))
    db.commit()
