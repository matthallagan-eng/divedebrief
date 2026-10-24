from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import Dive, User
from ..schemas import Headline, TrendPoint, Trends
from ..scoring import overall_score
from ..scoring.store import SKILLS, ensure_scores

router = APIRouter(prefix="/trends", tags=["trends"])

# Headlines compare the last HEADLINE_DIVES scored dives with the ones before
HEADLINE_DIVES = 10


def _mean(values: list[int]) -> int | None:
    return round(sum(values) / len(values)) if values else None


def headline(skill: str, newest_first: list[int | None]) -> Headline:
    scored = [v for v in newest_first if v is not None]
    recent, previous = scored[:HEADLINE_DIVES], scored[HEADLINE_DIVES : 2 * HEADLINE_DIVES]
    return Headline(
        skill=skill,
        recent=_mean(recent),
        recent_dives=len(recent),
        previous=_mean(previous),
        previous_dives=len(previous),
    )


@router.get("", response_model=Trends)
def trends(
    site: str | None = Query(None, description='A site id, or "unknown" for dives without GPS'),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Each dive's scores and ascent rates over time, and how the last
    HEADLINE_DIVES compare with the ones before. Optionally for one site."""
    query = select(Dive).where(Dive.user_id == user.id)
    if site == "unknown":
        query = query.where(Dive.site_id.is_(None))
    elif site is not None:
        if not site.isdigit():
            raise HTTPException(422, 'site must be a site id or "unknown"')
        query = query.where(Dive.site_id == int(site))
    dives = db.scalars(query.options(selectinload(Dive.scores)).order_by(Dive.started_at)).all()
    cfg = ensure_scores(db, user.id, list(dives))

    points = []
    for d in dives:
        scores = {s.skill: s.score for s in d.scores}
        ascent = next((s.metrics for s in d.scores if s.skill == "ascent"), {})
        points.append(TrendPoint(
            id=d.id,
            started_at=d.started_at,
            site_id=d.site_id,
            scores={k: scores.get(k) for k in SKILLS},
            overall_score=overall_score(scores, cfg),
            median_ascent_m_per_min=ascent.get("median_ascent_m_per_min"),
            max_ascent_m_per_min=ascent.get("max_ascent_m_per_min"),
        ))

    newest = points[::-1]
    return Trends(
        points=points,
        headlines=[headline(k, [p.scores[k] for p in newest]) for k in SKILLS]
        + [headline("overall", [p.overall_score for p in newest])],
        window=HEADLINE_DIVES,
    )
