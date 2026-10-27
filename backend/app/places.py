"""Name suggestions for a dive site, from OpenStreetMap via the Overpass API.

One query asks for:
- the named areas the site lies inside: the lake, quarry or park,
- named dive sites (sport=scuba_diving) within DIVE_SITE_RADIUS_M,
- named water, reefs, bays and quarries within NEARBY_RADIUS_M,
- the named sea, ocean or bay within SEA_RADIUS_M, for open-water sites.

Suggestions are ranked by how likely each is to be the site's name: a dive
site right at the spot, then the water the site is in, then dive sites and
features further off, then the park, then the sea. Within a rank, nearer wins.

The public Overpass servers are often overloaded, so every configured server
is asked at once and the first answer wins. Nominatim's reverse lookup runs
alongside as the fallback: it names the feature at the spot, usually the
lake or quarry, but knows nothing about dive sites. So the diver waits at
most about TIMEOUT_S. Only the site's position is sent, nothing about
the diver.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass

import httpx

from .config import settings
from .marine import marine_areas
from .sites import distance_m

DIVE_SITE_RADIUS_M = 1500
NEARBY_RADIUS_M = 400
SEA_RADIUS_M = 40_000
# A dive site this close is almost certainly where the diver was
AT_SITE_M = 300
MAX_SUGGESTIONS = 5
TIMEOUT_S = 10
# Overpass usually answers in a second or two; when it's this slow it's at
# capacity, and the diver shouldn't wait on it
OVERPASS_WAIT_S = 6
# Overpass asks clients to identify themselves
USER_AGENT = "DiveDebrief/0.1 (dive log app; https://github.com/matthallagan-eng/divedebrief)"

WATER_KINDS = {"reef": "Reef", "bay": "Bay", "strait": "Strait"}
FEATURES = "natural|water|landuse|leisure"


class PlacesUnavailable(Exception):
    """The lookup service couldn't be reached or gave a bad answer."""


@dataclass(frozen=True)
class Suggestion:
    name: str
    kind: str  # shown next to the name, e.g. "Dive site", "Lake"
    distance_m: int  # 0 when the site is inside it

    def as_dict(self) -> dict:
        return asdict(self)


def _query(lat: float, lon: float) -> str:
    at = f"{lat:.6f},{lon:.6f}"
    return f"""[out:json][timeout:{TIMEOUT_S}];
is_in({at})->.a;
area.a[name][~"^({FEATURES})$"~"."];
out tags;
(
  nwr(around:{DIVE_SITE_RADIUS_M},{at})["sport"="scuba_diving"]["name"];
  nwr(around:{NEARBY_RADIUS_M},{at})["natural"~"^(water|reef|bay|strait)$"]["name"];
  nwr(around:{NEARBY_RADIUS_M},{at})["landuse"="quarry"]["name"];
  node(around:{SEA_RADIUS_M},{at})["place"~"^(sea|ocean|bay)$"]["name"];
);
out tags center;"""


# Names are suggested in English when OpenStreetMap has one, not in the local script
LANGUAGE = "en"


def local_name(tags: dict) -> str:
    return (tags.get(f"name:{LANGUAGE}") or tags.get("name") or "").strip()


def _overpass(url: str, query: str) -> list[dict]:
    try:
        res = httpx.post(url, data={"data": query}, headers={"User-Agent": USER_AGENT}, timeout=OVERPASS_WAIT_S)
        res.raise_for_status()
        return res.json()["elements"]
    except (httpx.HTTPError, ValueError, KeyError) as e:
        raise PlacesUnavailable(f"{url}: {e}") from e


def fetch_elements(lat: float, lon: float) -> list[dict]:
    """Overpass elements around the spot, from whichever server answers first."""
    urls = [u.strip() for u in settings.overpass_urls.split(",") if u.strip()]
    query = _query(lat, lon)
    errors = []
    pool = ThreadPoolExecutor(len(urls))
    try:
        for done in as_completed(pool.submit(_overpass, url, query) for url in urls):
            try:
                return done.result()
            except PlacesUnavailable as e:
                errors.append(str(e))
    finally:
        pool.shutdown(wait=False)  # don't wait for the slower servers
    raise PlacesUnavailable("; ".join(errors))


def reverse_lookup(lat: float, lon: float) -> list[Suggestion]:
    """The named natural feature or place of interest at the spot, if any."""
    try:
        res = httpx.get(
            settings.nominatim_url,
            params={"format": "jsonv2", "lat": f"{lat:.6f}", "lon": f"{lon:.6f}", "zoom": 17, "layer": "natural,poi",
                    "accept-language": LANGUAGE},
            headers={"User-Agent": USER_AGENT},
            timeout=TIMEOUT_S,
        )
        res.raise_for_status()
        place = res.json()
    except (httpx.HTTPError, ValueError) as e:
        raise PlacesUnavailable(str(e)) from e
    name = (place.get("name") or "").strip()
    if not name or "lat" not in place:
        return []  # "Unable to geocode": open water, usually
    kind = (place.get("addresstype") or place.get("type") or "place").replace("_", " ").capitalize()
    distance = round(distance_m(lat, lon, float(place["lat"]), float(place["lon"])))
    return [Suggestion(name, kind, distance)]


def _classify(el: dict, inside: bool, distance: int) -> tuple[int, str] | None:
    """(rank, kind) for an Overpass element, or None to leave it out."""
    tags = el.get("tags", {})
    natural, place = tags.get("natural"), tags.get("place")
    if tags.get("sport") == "scuba_diving":
        return (0 if distance <= AT_SITE_M else 2), "Dive site"
    if place in ("sea", "ocean", "bay"):
        return 5, place.capitalize()
    if natural == "water" or "water" in tags:
        kind = tags.get("water", "water").replace("_", " ").capitalize()
        return (1 if inside else 3), "Body of water" if kind == "Water" else kind
    if natural in WATER_KINDS:
        return (1 if inside else 3), WATER_KINDS[natural]
    if tags.get("landuse") == "quarry":
        return (1 if inside else 3), "Quarry"
    if inside and tags.get("leisure") in ("park", "nature_reserve"):
        return 4, "Park"
    return None


# Natural Earth classes for small, local areas, ranked like nearby water;
# seas, gulfs and oceans rank with the seas Overpass finds
LOCAL_MARINE = {"reef", "lagoon", "bay", "inlet", "fjord", "sound", "channel", "strait"}


def _marine(lat: float, lon: float) -> list[tuple[int, int, Suggestion]]:
    return [
        (3 if m.kind in LOCAL_MARINE else 5, 0, Suggestion(m.name, m.kind.capitalize(), 0))
        for m in marine_areas(lat, lon)
    ]


def _ranked(entries) -> list[Suggestion]:
    """Best first, one per name ignoring case, keeping each name's best rank."""
    ranked: dict[str, tuple[int, int, Suggestion]] = {}
    for rank, distance, s in entries:
        key = s.name.casefold()
        if key not in ranked or (rank, distance) < ranked[key][:2]:
            ranked[key] = (rank, distance, s)
    return [s for _, _, s in sorted(ranked.values(), key=lambda r: r[:2])][:MAX_SUGGESTIONS]


def lookup_names(lat: float, lon: float) -> tuple[list[Suggestion], bool]:
    """Suggestions for a site, and whether the lookup was complete: False
    when Overpass couldn't be reached, so the answer shouldn't be kept.
    Raises PlacesUnavailable when nothing at all could be found that way."""
    with ThreadPoolExecutor(2) as pool:
        reverse = pool.submit(reverse_lookup, lat, lon)
        try:
            elements = fetch_elements(lat, lon)
        except PlacesUnavailable as overpass:
            try:
                found = [(3, s.distance_m, s) for s in reverse.result()]
            except PlacesUnavailable:
                found = []
            partial = _ranked(found + _marine(lat, lon))
            if not partial:
                raise overpass
            return partial, False
    return suggest_names(lat, lon, elements), True


def suggest_names(lat: float, lon: float, elements: list[dict]) -> list[Suggestion]:
    """Ranked, de-duplicated name suggestions from Overpass elements, with the
    marine areas the site is in."""
    entries = _marine(lat, lon)
    for el in elements:
        name = local_name(el.get("tags", {}))
        if not name:
            continue
        # Areas from is_in contain the site; everything else has a position
        inside = el.get("type") == "area"
        where = el.get("center") or el
        distance = 0
        if not inside and "lat" in where and "lon" in where:
            distance = round(distance_m(lat, lon, where["lat"], where["lon"]))
        kind = _classify(el, inside, distance)
        if kind is None:
            continue
        rank, label = kind
        entries.append((rank, distance, Suggestion(name, label, distance)))
    return _ranked(entries)
