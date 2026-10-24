from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import Dive, DiveNotes, DiveTank, User
from ..schemas import (
    DiveDetail, DiveSummary, NotesIn, NotesOut, NoteTags, ProfilePoint, SampleOut, SiteRef,
    SkillScoreDetail, TankIn, TankOut,
)
from ..scoring import Profile, ScoringSettings, overall_score
from ..scoring.store import SKILLS, ensure_scores

router = APIRouter(prefix="/dives", tags=["dives"])


def _summary_fields(dive: Dive, cfg: ScoringSettings) -> dict:
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
    )


@router.get("", response_model=list[DiveSummary])
def list_dives(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dives = db.scalars(
        select(Dive)
        .where(Dive.user_id == user.id)
        .options(selectinload(Dive.scores), selectinload(Dive.site))
        .order_by(Dive.started_at.desc())
    ).all()
    cfg = ensure_scores(db, user.id, list(dives))
    return [DiveSummary(**_summary_fields(d, cfg)) for d in dives]


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


@router.get("/{dive_id}", response_model=DiveDetail)
def get_dive(dive_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dive = db.scalar(
        select(Dive)
        .where(Dive.id == dive_id, Dive.user_id == user.id)
        .options(
            selectinload(Dive.samples), selectinload(Dive.scores), selectinload(Dive.tank),
            selectinload(Dive.site), selectinload(Dive.notes),
        )
    )
    if dive is None:
        raise HTTPException(404, "Dive not found")
    cfg = ensure_scores(db, user.id, [dive])
    p = Profile.from_samples(
        [s.t_s for s in dive.samples], [s.depth_m for s in dive.samples], cfg.ascent_window_s
    )
    fields = _summary_fields(dive, cfg)
    fields["scores"] = [SkillScoreDetail.model_validate(s) for s in fields["scores"]]
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


def _own_dive(db: Session, dive_id: int, user: User) -> Dive:
    dive = db.scalar(select(Dive).where(Dive.id == dive_id, Dive.user_id == user.id))
    if dive is None:
        raise HTTPException(404, "Dive not found")
    return dive
