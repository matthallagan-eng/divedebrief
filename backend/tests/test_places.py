import httpx
import pytest

from app import places
from app.marine import marine_areas
from app.places import PlacesUnavailable, lookup_names, suggest_names

from test_sites import _located_dive, _upload

QUARRY = (41.37071, -83.31556)

# Trimmed from a real Overpass answer for the quarry, plus made-up extras
QUARRY_ELEMENTS = [
    {"type": "area", "id": 1, "tags": {"name": "White Star Quarry", "natural": "water", "water": "lake"}},
    {"type": "area", "id": 2, "tags": {"name": "White Star Park", "leisure": "park"}},
    {"type": "area", "id": 3, "tags": {"name": "Sandusky County", "boundary": "administrative"}},
    {"type": "way", "id": 4, "center": {"lat": 41.3712, "lon": -83.3150},
     "tags": {"name": "White Star Quarry", "natural": "water", "water": "lake"}},
    {"type": "node", "id": 5, "lat": 41.3800, "lon": -83.3156,
     "tags": {"name": "Sunken Bus", "sport": "scuba_diving"}},
    {"type": "node", "id": 6, "lat": 41.3708, "lon": -83.3155, "tags": {"sport": "scuba_diving"}},
]


def test_water_the_site_is_in_comes_before_a_dive_site_a_kilometre_away():
    found = suggest_names(*QUARRY, elements=QUARRY_ELEMENTS)
    assert [(s.name, s.kind) for s in found] == [
        ("White Star Quarry", "Lake"),  # once, as the area it's inside
        ("Sunken Bus", "Dive site"),
        ("White Star Park", "Park"),
    ]
    assert found[0].distance_m == 0
    assert found[1].distance_m == pytest.approx(1032, abs=5)


def test_a_dive_site_at_the_spot_comes_first_and_the_sea_last():
    elements = [
        {"type": "node", "lat": 12.1614, "lon": -68.2839, "tags": {"name": "Something Special", "sport": "scuba_diving"}},
        {"type": "node", "lat": 12.30, "lon": -68.50, "tags": {"name": "Caribbean Sea", "place": "sea"}},
        {"type": "node", "lat": 12.1600, "lon": -68.2830, "tags": {"name": "Kralendijk Reef", "natural": "reef"}},
    ]
    found = suggest_names(12.1599, -68.2822, elements=elements)
    assert [(s.name, s.kind) for s in found] == [
        ("Something Special", "Dive site"),
        ("Kralendijk Reef", "Reef"),
        ("Caribbean Sea", "Sea"),
    ]


def test_suggestions_are_capped():
    elements = [
        {"type": "node", "lat": 12.16, "lon": -68.28 + i / 1000, "tags": {"name": f"Reef {i}", "sport": "scuba_diving"}}
        for i in range(8)
    ]
    assert len(suggest_names(12.16, -68.28, elements=elements)) == places.MAX_SUGGESTIONS



def test_names_are_suggested_in_english_when_osm_has_one():
    elements = [
        {"type": "node", "lat": 27.0, "lon": 34.0, "tags": {"name": "البحر الأحمر", "name:en": "Red Sea", "place": "sea"}},
        {"type": "node", "lat": 27.0, "lon": 34.001, "tags": {"name": "珊瑚礁", "sport": "scuba_diving"}},
    ]
    names = [s.name for s in suggest_names(27.0, 34.0, elements=elements)]
    # Without an English name, the local one is still better than nothing
    assert names == ["珊瑚礁", "Red Sea"]


def _refuse(*args, **kwargs):
    raise httpx.ConnectError("no route")


class _Reply:
    def __init__(self, body):
        self.body = body

    def raise_for_status(self):
        pass

    def json(self):
        return self.body


def test_a_busy_overpass_server_falls_through_to_another(monkeypatch):
    tried = []

    def post(url, **kwargs):
        tried.append(url)
        if len(tried) == 1:
            raise httpx.ReadTimeout("busy")
        return _Reply({"elements": QUARRY_ELEMENTS})

    monkeypatch.setattr(places.httpx, "post", post)
    found, complete = lookup_names(*QUARRY)
    assert complete
    assert len(tried) == 2 and tried[0] != tried[1]
    assert found[0].name == "White Star Quarry"


def test_falls_back_to_reverse_lookup_when_overpass_is_down(monkeypatch):
    monkeypatch.setattr(places.httpx, "post", _refuse)
    # Trimmed from a real Nominatim answer for the quarry
    reply = {"lat": "41.3714996", "lon": "-83.3173526", "name": "White Star Quarry", "addresstype": "lake"}
    monkeypatch.setattr(places.httpx, "get", lambda url, **kwargs: _Reply(reply))
    [found], complete = lookup_names(*QUARRY)
    assert not complete  # Overpass may know more next time
    assert (found.name, found.kind) == ("White Star Quarry", "Lake")
    assert found.distance_m == pytest.approx(173, abs=5)


def test_unreachable_or_empty_lookup_raises(monkeypatch):
    monkeypatch.setattr(places.httpx, "post", _refuse)
    monkeypatch.setattr(places.httpx, "get", _refuse)
    with pytest.raises(PlacesUnavailable):
        lookup_names(*QUARRY)

    # Nominatim has nothing here and it's not at sea: nothing to show yet
    monkeypatch.setattr(places.httpx, "get", lambda url, **kwargs: _Reply({"error": "Unable to geocode"}))
    with pytest.raises(PlacesUnavailable):
        lookup_names(*QUARRY)


def test_offshore_sites_are_named_from_marine_areas_when_overpass_is_down(monkeypatch):
    monkeypatch.setattr(places.httpx, "post", _refuse)
    monkeypatch.setattr(places.httpx, "get", lambda url, **kwargs: _Reply({"error": "Unable to geocode"}))
    found, complete = lookup_names(-16.735, 146.264)  # off Cairns
    assert not complete
    assert [(s.name, s.kind) for s in found] == [("Great Barrier Reef", "Reef"), ("Coral Sea", "Sea")]
    assert [s.name for s in lookup_names(28.05, -83.01)[0]] == ["Gulf of Mexico"]


def test_marine_areas_are_only_at_sea():
    assert [m.name for m in marine_areas(26.80, 33.99)] == ["Red Sea"]
    assert marine_areas(*QUARRY) == []


def test_site_suggestions_are_looked_up_once_and_kept(client, monkeypatch):
    calls = []

    def fake_fetch(lat, lon):
        calls.append((lat, lon))
        return QUARRY_ELEMENTS

    monkeypatch.setattr(places, "fetch_elements", fake_fetch)
    _upload(client, "a.uddf", _located_dive("2026-05-01T10:00:00", *QUARRY))
    [site] = client.get("/sites").json()["sites"]

    first = client.get(f"/sites/{site['id']}/suggestions").json()
    assert first["error"] is None
    assert first["suggestions"][0] == {"name": "White Star Quarry", "kind": "Lake", "distance_m": 0}
    assert client.get(f"/sites/{site['id']}/suggestions").json() == first
    assert len(calls) == 1


def test_failed_lookup_is_reported_and_retried(client, monkeypatch):
    def down(lat, lon):
        raise PlacesUnavailable("timeout")

    monkeypatch.setattr(places, "fetch_elements", down)
    monkeypatch.setattr(places, "reverse_lookup", lambda lat, lon: [])
    _upload(client, "a.uddf", _located_dive("2026-05-01T10:00:00", *QUARRY))
    [site] = client.get("/sites").json()["sites"]
    body = client.get(f"/sites/{site['id']}/suggestions").json()
    assert body["suggestions"] == [] and "OpenStreetMap is busy" in body["error"]

    monkeypatch.setattr(places, "fetch_elements", lambda lat, lon: QUARRY_ELEMENTS)
    assert client.get(f"/sites/{site['id']}/suggestions").json()["suggestions"]


def test_suggestions_for_another_divers_site_are_not_found(client, anon_client):
    from conftest import sign_up

    _upload(client, "a.uddf", _located_dive("2026-05-01T10:00:00", *QUARRY))
    [site] = client.get("/sites").json()["sites"]
    other = sign_up(anon_client, email="other@example.com")
    assert anon_client.get(f"/sites/{site['id']}/suggestions", headers=other).status_code == 404


def test_a_partial_lookup_is_shown_but_not_kept(client, monkeypatch):
    def down(lat, lon):
        raise PlacesUnavailable("timeout")

    monkeypatch.setattr(places, "fetch_elements", down)
    monkeypatch.setattr(places, "reverse_lookup", lambda lat, lon: [])
    _upload(client, "a.uddf", _located_dive("2026-05-01T10:00:00", 28.05, -83.01))
    [site] = client.get("/sites").json()["sites"]
    body = client.get(f"/sites/{site['id']}/suggestions").json()
    assert body == {"suggestions": [{"name": "Gulf of Mexico", "kind": "Gulf", "distance_m": 0}], "error": None}

    # Overpass is back: asked again, and its dive site joins the sea
    shipwreck = {"type": "node", "lat": 28.0505, "lon": -83.01, "tags": {"name": "Sunken Tug", "sport": "scuba_diving"}}
    monkeypatch.setattr(places, "fetch_elements", lambda lat, lon: [shipwreck])
    names = [s["name"] for s in client.get(f"/sites/{site['id']}/suggestions").json()["suggestions"]]
    assert names == ["Sunken Tug", "Gulf of Mexico"]
