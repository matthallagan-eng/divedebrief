"""Builds app/data/marine_areas.json.gz from Natural Earth's named marine areas.

Natural Earth is public domain (https://www.naturalearthdata.com). Download
ne_10m_geography_marine_polys.geojson from the natural-earth-vector repository
(geojson/ folder, tag v5.1.2) and run:

    python scripts/build_marine_areas.py path/to/ne_10m_geography_marine_polys.geojson
"""
import gzip
import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "app" / "data" / "marine_areas.json.gz"


def main(source: str) -> None:
    features = json.loads(Path(source).read_text(encoding="utf-8"))["features"]
    areas = []
    for f in features:
        p = f["properties"]
        name = (p.get("name_en") or p.get("name") or "").strip()
        if not name:
            continue
        g = f["geometry"]
        polygons = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        # About 100 m of precision is plenty for naming a sea
        polygons = [[[[round(x, 3), round(y, 3)] for x, y in ring] for ring in poly] for poly in polygons]
        xs = [x for poly in polygons for x, _ in poly[0]]
        ys = [y for poly in polygons for _, y in poly[0]]
        areas.append({
            "name": name,
            "kind": p.get("featurecla") or "sea",
            "scalerank": p.get("scalerank") or 0,
            "bbox": [min(xs), min(ys), max(xs), max(ys)],
            "polygons": polygons,
        })
    OUT.parent.mkdir(exist_ok=True)
    with gzip.open(OUT, "wt", encoding="utf-8") as f:
        json.dump(areas, f, separators=(",", ":"))
    print(f"{len(areas)} areas -> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main(sys.argv[1])
