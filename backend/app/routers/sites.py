from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import Dive, Site, User
from ..places import PlacesUnavailable, lookup_names
from ..schemas import DiveMap, MapDive, NameSuggestions, SiteIn, SiteOut, SiteRef
from ..scoring import overall_score
from ..scoring.store import SKILLS, ensure_scores
from ..sites import assign_sites
from .dives import tally

router = APIRouter(prefix="/sites", tags=["sites"])


def _mean(values: list[int | None]) -> int | None:
    scored = [v for v in values if v is not None]
    return round(sum(scored) / len(scored)) if scored else None


@router.get("", response_model=DiveMap)
def dive_map(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Every site with its dives, for the map. Also groups dives that have
    no site yet, such as those stored before sites existed."""
    assign_sites(db, user.id)
    dives = db.scalars(
        select(Dive)
        .where(Dive.user_id == user.id)
        .options(selectinload(Dive.scores), selectinload(Dive.notes))
        .order_by(Dive.started_at.desc())
    ).all()
    cfg = ensure_scores(db, user.id, list(dives))
    notes = {d.id: d.notes for d in dives if d.notes is not None}

    by_site: dict[int | None, list[tuple[MapDive, dict[str, int | None]]]] = {}
    for d in dives:
        scores = {s.skill: s.score for s in d.scores}
        fields = {f: getattr(d, f) for f in MapDive.model_fields if f != "overall_score"}
        out = MapDive(**fields, overall_score=overall_score(scores, cfg))
        by_site.setdefault(d.site_id, []).append((out, scores))

    sites = db.scalars(
        select(Site).where(Site.user_id == user.id, Site.id.in_([k for k in by_site if k]))
    ).all()
    return DiveMap(
        sites=[
            SiteOut(
                **SiteRef.model_validate(site).model_dump(),
                average_scores={
                    skill: _mean([scores.get(skill) for _, scores in by_site[site.id]])
                    for skill in SKILLS
                },
                average_overall=_mean([d.overall_score for d, _ in by_site[site.id]]),
                dives=[d for d, _ in by_site[site.id]],
                sea_life=tally(notes[d.id].sea_life for d, _ in by_site[site.id][::-1] if d.id in notes),
                landmarks=tally(notes[d.id].landmarks for d, _ in by_site[site.id][::-1] if d.id in notes),
            )
            for site in sites
        ],
        unknown=[d for d, _ in by_site.get(None, [])],
    )


@router.get("/{site_id}/suggestions", response_model=NameSuggestions)
def name_suggestions(site_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Names of dive sites and bodies of water at the site, from OpenStreetMap.
    Looked up once per site and kept; a failed lookup is retried next time."""
    site = _own_site(db, site_id, user)
    if site.name_suggestions is None:
        try:
            found, complete = lookup_names(site.latitude, site.longitude)
        except PlacesUnavailable:
            return NameSuggestions(
                suggestions=[], error="OpenStreetMap is busy right now, so names nearby couldn't be looked up. Try again in a few minutes."
            )
        if not complete:
            # What could be found without Overpass; it's asked again next time
            return NameSuggestions(suggestions=[s.as_dict() for s in found])
        site.name_suggestions = [s.as_dict() for s in found]
        db.commit()
    return NameSuggestions(suggestions=site.name_suggestions)


@router.put("/{site_id}", response_model=SiteRef)
def put_site(
    site_id: int, body: SiteIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Name the site and set its water type. Air efficiency scores pick up
    the new water type the next time they're read."""
    site = _own_site(db, site_id, user)
    site.name, site.water_type = body.name, body.water_type
    db.commit()
    return site


def _own_site(db: Session, site_id: int, user: User) -> Site:
    site = db.scalar(select(Site).where(Site.id == site_id, Site.user_id == user.id))
    if site is None:
        raise HTTPException(404, "Site not found")
    return site
