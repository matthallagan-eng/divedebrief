"""Named seas, gulfs, bays and reefs, looked up locally so an offshore site
always gets a name, even when OpenStreetMap's servers are busy.

The areas come from Natural Earth (public domain), built into
data/marine_areas.json.gz by scripts/build_marine_areas.py.
"""
import gzip
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).parent / "data" / "marine_areas.json.gz"


@dataclass(frozen=True)
class MarineArea:
    name: str
    kind: str  # Natural Earth's class: sea, gulf, bay, strait, reef, ...
    scalerank: int  # higher is smaller and more local


@lru_cache(maxsize=1)
def _areas() -> list[dict]:
    with gzip.open(DATA, "rt", encoding="utf-8") as f:
        return json.load(f)


def _in_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    inside = False
    for i in range(len(ring)):
        x1, y1 = ring[i]
        x2, y2 = ring[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def marine_areas(lat: float, lon: float) -> list[MarineArea]:
    """The named marine areas the point is in, most local first."""
    found = []
    for a in _areas():
        west, south, east, north = a["bbox"]
        if not (west <= lon <= east and south <= lat <= north):
            continue
        for outer, *holes in a["polygons"]:
            if _in_ring(lon, lat, outer) and not any(_in_ring(lon, lat, h) for h in holes):
                found.append(MarineArea(a["name"], a["kind"], a["scalerank"]))
                break
    return sorted(found, key=lambda m: -m.scalerank)
