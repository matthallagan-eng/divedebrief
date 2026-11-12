import pytest

from test_sites import _located_dive, _upload


def _dive(client, when="2026-05-01T10:00:00", lat=12.5, lon=-70.0) -> int:
    _upload(client, f"{when}.uddf", _located_dive(when, lat, lon))
    return next(d["id"] for d in client.get("/dives").json() if d["started_at"].startswith(when))


def test_notes_are_saved_cleaned_and_returned(client):
    dive = _dive(client)
    assert client.get(f"/dives/{dive}").json()["notes"] is None

    res = client.put(f"/dives/{dive}/notes", json={
        "feeling": 4,
        "sea_life": [" Green  turtle ", "green turtle", "Sergeant major", ""],
        "landmarks": ["Mooring buoy"],
        "text": "  Calm and clear, 20 m vis.  ",
    })
    assert res.status_code == 200
    notes = client.get(f"/dives/{dive}").json()["notes"]
    assert notes["feeling"] == 4
    assert notes["sea_life"] == ["Green turtle", "Sergeant major"]
    assert notes["landmarks"] == ["Mooring buoy"]
    assert notes["text"] == "Calm and clear, 20 m vis."
    # The logbook list carries the sea life and buddy for grouping
    [listed] = client.get("/dives").json()
    assert (listed["sea_life"], listed["buddy"]) == (["Green turtle", "Sergeant major"], None)

    # Saving again replaces the notes
    client.put(f"/dives/{dive}/notes", json={"feeling": None, "text": "Rewritten"})
    notes = client.get(f"/dives/{dive}").json()["notes"]
    assert (notes["feeling"], notes["sea_life"], notes["text"]) == (None, [], "Rewritten")


@pytest.mark.parametrize(
    "body",
    [
        {"feeling": 0},
        {"feeling": 6},
        {"sea_life": ["x" * 61]},
        {"landmarks": ["wreck"] * 41},
        {"text": "x" * 5001},
    ],
)
def test_notes_reject_bad_values(client, body):
    dive = _dive(client)
    assert client.put(f"/dives/{dive}/notes", json=body).status_code == 422


def test_note_tags_and_site_sightings_list_the_most_noted_first(client):
    a = _dive(client, "2026-05-01T10:00:00")
    b = _dive(client, "2026-05-02T10:00:00")
    far = _dive(client, "2026-05-03T10:00:00", lat=20.0, lon=-80.0)
    client.put(f"/dives/{a}/notes", json={"sea_life": ["Moray eel", "Tarpon"], "landmarks": ["Anchor"]})
    client.put(f"/dives/{b}/notes", json={"sea_life": ["tarpon"]})
    client.put(f"/dives/{far}/notes", json={"sea_life": ["Nurse shark"]})

    tags = client.get("/dives/note-tags").json()
    assert tags["sea_life"][0] == "Tarpon"  # twice, first written capitalised
    assert set(tags["sea_life"]) == {"Tarpon", "Moray eel", "Nurse shark"}
    assert tags["landmarks"] == ["Anchor"]

    sites = client.get("/sites").json()["sites"]
    shared = next(s for s in sites if len(s["dives"]) == 2)
    assert shared["sea_life"] == ["Tarpon", "Moray eel"]
    assert shared["landmarks"] == ["Anchor"]


def test_notes_on_another_divers_dive_are_not_found(client, anon_client):
    from conftest import sign_up

    dive = _dive(client)
    other = sign_up(anon_client, email="other@example.com")
    res = anon_client.put(f"/dives/{dive}/notes", json={"text": "mine"}, headers=other)
    assert res.status_code == 404
    assert anon_client.get("/dives/note-tags", headers=other).json() == {"sea_life": [], "landmarks": []}


def test_deleting_a_dive_deletes_its_notes(client):
    dive = _dive(client)
    client.put(f"/dives/{dive}/notes", json={"sea_life": ["Barracuda"]})
    client.delete(f"/dives/{dive}")
    assert client.get("/dives/note-tags").json()["sea_life"] == []


def test_conditions_are_saved(client):
    dive = _dive(client)
    client.put(f"/dives/{dive}/notes", json={"visibility_m": 8, "buddy": "  Sam  "})
    notes = client.get(f"/dives/{dive}").json()["notes"]
    assert (notes["visibility_m"], notes["buddy"]) == (8, "Sam")
    client.put(f"/dives/{dive}/notes", json={"buddy": "  "})
    assert client.get(f"/dives/{dive}").json()["notes"]["buddy"] is None
    assert client.put(f"/dives/{dive}/notes", json={"visibility_m": -1}).status_code == 422


def test_the_debrief_names_creatures_the_dive_unlocked(client):
    dive = _dive(client)
    first = {a["key"]: a for a in client.get("/achievements").json()["achievements"]}["clownfish"]
    assert first["earned_dive_id"] == dive
    titles = [i["title"] for i in client.get(f"/dives/{dive}").json()["debrief"]["items"]]
    assert "New creature: Clownfish" in titles
