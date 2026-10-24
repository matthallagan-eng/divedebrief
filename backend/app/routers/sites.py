from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import Dive, Site, User
from ..schemas import DiveMap, MapDive, SiteIn, SiteOut, SiteRef
from ..scoring import overall_score
from ..scoring.store import SKILLS, ensure_scores
from ..sites import assign_sites

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
        .options(selectinload(Dive.scores))
        .order_by(Dive.started_at.desc())
    ).all()
    cfg = ensure_scores(db, user.id, list(dives))

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
            )
            for site in sites
        ],
        unknown=[d for d, _ in by_site.get(None, [])],
    )


@router.put("/{site_id}", response_model=SiteRef)
def put_site(
    site_id: int, body: SiteIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Name the site and set its water type. Air efficiency scores pick up
    the new water type the next time they're read."""
    site = db.scalar(select(Site).where(Site.id == site_id, Site.user_id == user.id))
    if site is None:
        raise HTTPException(404, "Site not found")
    site.name, site.water_type = body.name, body.water_type
    db.commit()
    return site
