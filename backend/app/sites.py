"""Grouping dives into sites by where they took place.

A dive joins the nearest of the diver's sites whose centre is within
SITE_RADIUS_M of the dive's position; otherwise it starts a new site. A
site's centre is the mean position of its dives. Dives without a position
stay out of every site and are listed as "Unknown site".
"""
from math import asin, cos, radians, sin, sqrt

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .models import Dive, Site

SITE_RADIUS_M = 200
EARTH_RADIUS_M = 6_371_000


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle (haversine) distance in metres."""
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(a))


def assign_sites(db: Session, user_id: int) -> None:
    """Put each of the diver's located dives that has no site into one.
    Oldest dives go first, so a site's centre starts where it was first dived."""
    loose = db.scalars(
        select(Dive)
        .where(Dive.user_id == user_id, Dive.site_id.is_(None), Dive.latitude.is_not(None))
        .order_by(Dive.started_at)
    ).all()
    if not loose:
        return
    sites = list(
        db.scalars(select(Site).where(Site.user_id == user_id).options(selectinload(Site.dives)))
    )
    for dive in loose:
        nearest = min(
            sites,
            key=lambda s: distance_m(s.latitude, s.longitude, dive.latitude, dive.longitude),
            default=None,
        )
        if nearest is None or (
            distance_m(nearest.latitude, nearest.longitude, dive.latitude, dive.longitude)
            > SITE_RADIUS_M
        ):
            nearest = Site(user_id=user_id, latitude=dive.latitude, longitude=dive.longitude)
            db.add(nearest)
            sites.append(nearest)
        nearest.dives.append(dive)
        located = [d for d in nearest.dives if d.latitude is not None]
        nearest.latitude = sum(d.latitude for d in located) / len(located)
        nearest.longitude = sum(d.longitude for d in located) / len(located)
    db.commit()
