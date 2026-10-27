from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..analysis.thermocline import find_thermocline
from ..database import get_db
from ..deps import get_current_user
from ..debrief import GearView, PreviousDive, ScoreView, build_debrief
from ..dive_day import DayPlace, day_bounds, place_in_day
from ..models import Dive, DiveGear, DiveNotes, DiveTank, User
from .milestones import load_milestones
from ..schemas import (
    DiveDetail, DiveSummary, GearHistoryRow, GearIn, GearOut, NotesIn, NotesOut, NoteTags, ProfilePoint,
    SampleOut, SiteRef, SkillScoreDetail, TankIn, TankOut, ThermoclineOut,
)
from ..scoring import Profile, ScoringSettings, overall_score
from ..scoring.store import SKILLS, ensure_scores

router = APIRouter(prefix="/dives", tags=["dives"])


def _summary_fields(dive: Dive, cfg: ScoringSettings, day: DayPlace) -> dict:
    scores = sorted(dive.scores, key=lambda s: SKILLS.index(s.skill))
    return dict(
        id=dive.id,
        upload_id=dive.upload_id,
        started_at=dive.started_at,
        duration_s=dive.duration_s,
        max_depth_m=dive.max_depth_m,
        avg_depth_m=dive.avg_depth_m,
        min_temp_k=dive.min_temp_k,
        computer_model=dive.computer_model,
        site_id=dive.site_id,
        site_name=dive.site and dive.site.name,
        overall_score=overall_score({s.skill: s.score for s in scores}, cfg),
        scores=scores,
        dive_of_day=day.dive_of_day,
        dives_that_day=day.dives_that_day,
        surface_interval_s=day.surface_interval_s,
        previous_dive_id=day.previous_dive_id,
        sea_life=dive.notes.sea_life if dive.notes else [],
        buddy=dive.notes and dive.notes.buddy,
    )


@router.get("", response_model=list[DiveSummary])
def list_dives(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dives = db.scalars(
        select(Dive)
        .where(Dive.user_id == user.id)
        .options(selectinload(Dive.scores), selectinload(Dive.site), selectinload(Dive.notes))
        .order_by(Dive.started_at.desc())
    ).all()
    cfg = ensure_scores(db, user.id, list(dives))
    days = place_in_day(dives)
    return [DiveSummary(**_summary_fields(d, cfg, days[d.id])) for d in dives]


def tally(lists) -> list[str]:
    """Distinct entries across lists, most frequent first, ignoring case.
    Each keeps its spelling in the first list, so pass the oldest dive first."""
    counts: Counter[str] = Counter()
    spelling: dict[str, str] = {}
    for tags in lists:
        for tag in tags:
            key = tag.casefold()
            spelling.setdefault(key, tag)
            counts[key] += 1
    return [spelling[k] for k, _ in counts.most_common()]


@router.get("/note-tags", response_model=NoteTags)
def note_tags(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    notes = db.scalars(
        select(DiveNotes).join(Dive).where(Dive.user_id == user.id).order_by(Dive.started_at)
    ).all()
    return NoteTags(
        sea_life=tally(n.sea_life for n in notes), landmarks=tally(n.landmarks for n in notes)
    )


@router.get("/gear-history", response_model=list[GearHistoryRow])
def gear_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Dives with gear logged, newest first, with their buoyancy score."""
    dives = db.scalars(
        select(Dive)
        .join(DiveGear)
        .where(Dive.user_id == user.id)
        .options(selectinload(Dive.scores), selectinload(Dive.site), selectinload(Dive.gear))
        .order_by(Dive.started_at.desc())
    ).all()
    ensure_scores(db, user.id, list(dives))
    return [
        GearHistoryRow(
            dive_id=d.id,
            started_at=d.started_at,
            site_name=d.site and d.site.name,
            weight_kg=d.gear.weight_kg,
            suit=d.gear.suit,
            tank_material=d.gear.tank_material,
            buoyancy_score=next((s.score for s in d.scores if s.skill == "buoyancy"), None),
        )
        for d in dives
    ]


def _gear_view(gear: DiveGear | None) -> GearView | None:
    return gear and GearView(weight_kg=gear.weight_kg, suit=gear.suit)


def _score_views(dive: Dive) -> dict[str, ScoreView]:
    return {s.skill: ScoreView(s.score, s.regions, s.metrics or {}) for s in dive.scores}


def _previous(db: Session, dive: Dive, user: User) -> PreviousDive | None:
    prev = db.scalar(
        select(Dive)
        .where(Dive.user_id == user.id, Dive.started_at < dive.started_at)
        .options(selectinload(Dive.scores), selectinload(Dive.gear), selectinload(Dive.samples))
        .order_by(Dive.started_at.desc())
        .limit(1)
    )
    if prev is None:
        return None
    cfg = ensure_scores(db, user.id, [prev])
    # Its focus is this dive's goal; the focus needs only its own scores and profile
    p = Profile.from_samples([s.t_s for s in prev.samples], [s.depth_m for s in prev.samples], cfg.ascent_window_s)
    focus = build_debrief(p, _score_views(prev), cfg, [], has_tank=True, gear=None, previous=None).focus
    return PreviousDive(scores={s.skill: s.score for s in prev.scores}, gear=_gear_view(prev.gear), focus=focus)


@router.get("/{dive_id}", response_model=DiveDetail)
def get_dive(dive_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dive = db.scalar(
        select(Dive)
        .where(Dive.id == dive_id, Dive.user_id == user.id)
        .options(
            selectinload(Dive.samples), selectinload(Dive.scores), selectinload(Dive.tank),
            selectinload(Dive.site), selectinload(Dive.notes), selectinload(Dive.gear),
        )
    )
    if dive is None:
        raise HTTPException(404, "Dive not found")
    cfg = ensure_scores(db, user.id, [dive])
    p = Profile.from_samples(
        [s.t_s for s in dive.samples], [s.depth_m for s in dive.samples], cfg.ascent_window_s
    )
    start, end = day_bounds(dive.started_at)
    same_day = db.execute(
        select(Dive.id, Dive.started_at, Dive.duration_s, Dive.max_depth_m)
        .where(Dive.user_id == user.id, Dive.started_at >= start, Dive.started_at < end)
    ).all()
    day = place_in_day(same_day)[dive.id]
    fields = _summary_fields(dive, cfg, day)
    fields["scores"] = [SkillScoreDetail.model_validate(s) for s in fields["scores"]]
    thermocline = find_thermocline(
        [s.t_s for s in dive.samples], [s.depth_m for s in dive.samples], [s.temp_k for s in dive.samples]
    )
    debrief = build_debrief(
        p,
        _score_views(dive),
        cfg,
        [s.ndl_s for s in dive.samples if s.ndl_s is not None],
        has_tank=dive.tank is not None,
        gear=_gear_view(dive.gear),
        previous=_previous(db, dive, user),
        thermocline=thermocline,
        new_milestones=[m for m in load_milestones(db, user) if m.earned_dive_id == dive.id],
        day=day,
    )
    return DiveDetail(
        **fields,
        computer_serial=dive.computer_serial,
        source=dive.source,
        tank=dive.tank and TankOut.model_validate(dive.tank),
        water_type=dive.water_type,
        latitude=dive.latitude,
        longitude=dive.longitude,
        entry_latitude=dive.entry_latitude,
        entry_longitude=dive.entry_longitude,
        exit_latitude=dive.exit_latitude,
        exit_longitude=dive.exit_longitude,
        site=dive.site and SiteRef.model_validate(dive.site),
        notes=dive.notes and NotesOut.model_validate(dive.notes),
        gear=dive.gear and GearOut.model_validate(dive.gear),
        thermocline=thermocline and ThermoclineOut.model_validate(thermocline),
        debrief=debrief,
        samples=[SampleOut.model_validate(s) for s in dive.samples],
        profile=[
            ProfilePoint(t_s=t, depth_m=d, rate_m_per_min=r) for t, d, r in zip(p.t, p.depth, p.rate)
        ],
    )


@router.delete("/{dive_id}", status_code=204)
def delete_dive(dive_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(_own_dive(db, dive_id, user))
    db.commit()


@router.put("/{dive_id}/tank", response_model=TankOut)
def put_tank(
    dive_id: int, body: TankIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Set the tank size, and the pressures unless the dive computer recorded them."""
    dive = _own_dive(db, dive_id, user)
    tank = dive.tank
    if body.start_bar is None:
        if tank is None:
            raise HTTPException(422, "Start and end pressure are needed for this dive")
        tank.volume_l = body.volume_l
    else:
        if tank is None:
            tank = dive.tank = DiveTank(source="manual")
        if (tank.start_bar, tank.end_bar) != (body.start_bar, body.end_bar):
            tank.source = "manual"
        tank.volume_l, tank.start_bar, tank.end_bar = body.volume_l, body.start_bar, body.end_bar
    db.commit()
    return tank


@router.delete("/{dive_id}/tank", status_code=204)
def delete_tank(dive_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dive = _own_dive(db, dive_id, user)
    if dive.tank is not None:
        db.delete(dive.tank)
        db.commit()


@router.put("/{dive_id}/notes", response_model=NotesOut)
def put_notes(
    dive_id: int, body: NotesIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    dive = _own_dive(db, dive_id, user)
    if dive.notes is None:
        dive.notes = DiveNotes()
    for field, value in body.model_dump().items():
        setattr(dive.notes, field, value)
    db.commit()
    return dive.notes


@router.put("/{dive_id}/gear", response_model=GearOut)
def put_gear(
    dive_id: int, body: GearIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    dive = _own_dive(db, dive_id, user)
    if dive.gear is None:
        dive.gear = DiveGear()
    for field, value in body.model_dump().items():
        setattr(dive.gear, field, value)
    db.commit()
    return dive.gear


@router.delete("/{dive_id}/gear", status_code=204)
def delete_gear(dive_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dive = _own_dive(db, dive_id, user)
    if dive.gear is not None:
        db.delete(dive.gear)
        db.commit()


def _own_dive(db: Session, dive_id: int, user: User) -> Dive:
    dive = db.scalar(select(Dive).where(Dive.id == dive_id, Dive.user_id == user.id))
    if dive is None:
        raise HTTPException(404, "Dive not found")
    return dive
