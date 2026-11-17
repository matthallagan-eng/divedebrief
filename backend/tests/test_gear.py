import pytest

from test_notes import _dive


def test_gear_is_saved_and_listed_with_buoyancy(client):
    first = _dive(client, "2026-05-01T10:00:00")
    second = _dive(client, "2026-05-02T10:00:00")
    detail = client.get(f"/dives/{first}").json()
    assert detail["gear"] is None
    assert detail["debrief"]["headline"]

    assert client.put(f"/dives/{first}/gear", json={"weight_kg": 6, "suit": "5mm", "tank_material": "aluminum"}).status_code == 200
    client.put(f"/dives/{second}/gear", json={"weight_kg": 5, "suit": "5mm"})
    gear = client.get(f"/dives/{first}").json()["gear"]
    assert (gear["weight_kg"], gear["suit"], gear["tank_material"]) == (6, "5mm", "aluminum")

    history = client.get("/dives/gear-history").json()
    assert [(r["dive_id"], r["weight_kg"]) for r in history] == [(second, 5), (first, 6)]
    assert "buoyancy_score" in history[0]

    assert client.delete(f"/dives/{first}/gear").status_code == 204
    assert client.get(f"/dives/{first}").json()["gear"] is None
    assert [r["dive_id"] for r in client.get("/dives/gear-history").json()] == [second]


@pytest.mark.parametrize("body", [{"weight_kg": -1}, {"weight_kg": 31}, {"suit": "wetsuit"}, {"tank_material": "carbon"}])
def test_gear_rejects_bad_values(client, body):
    dive = _dive(client)
    assert client.put(f"/dives/{dive}/gear", json=body).status_code == 422


def test_gear_on_another_divers_dive_is_not_found(client, anon_client):
    from conftest import sign_up

    dive = _dive(client)
    client.put(f"/dives/{dive}/gear", json={"weight_kg": 6})
    other = sign_up(anon_client, email="other@example.com")
    assert anon_client.put(f"/dives/{dive}/gear", json={"weight_kg": 4}, headers=other).status_code == 404
    assert anon_client.get("/dives/gear-history", headers=other).json() == []


def test_gear_presets_are_saved_renamed_and_deleted(client):
    assert client.get("/gear-presets").json() == []
    r = client.post("/gear-presets", json={"name": "  Quarry 7mm ", "weight_kg": 8, "suit": "7mm", "tank_material": "steel"})
    assert r.status_code == 201
    quarry = r.json()
    assert (quarry["name"], quarry["weight_kg"], quarry["suit"], quarry["tank_material"]) == ("Quarry 7mm", 8, "7mm", "steel")
    warm = client.post("/gear-presets", json={"name": "Warm water", "suit": "shorty"}).json()
    assert [p["name"] for p in client.get("/gear-presets").json()] == ["Quarry 7mm", "Warm water"]

    assert client.post("/gear-presets", json={"name": "Quarry 7mm"}).status_code == 409
    assert client.put(f"/gear-presets/{warm['id']}", json={"name": "Quarry 7mm"}).status_code == 409
    r = client.put(f"/gear-presets/{quarry['id']}", json={"name": "Quarry 7mm", "weight_kg": 7, "suit": "7mm", "tank_material": "steel"})
    assert r.json()["weight_kg"] == 7

    assert client.delete(f"/gear-presets/{warm['id']}").status_code == 204
    assert [p["name"] for p in client.get("/gear-presets").json()] == ["Quarry 7mm"]


@pytest.mark.parametrize("body", [{"name": ""}, {"name": "   "}, {"name": "x" * 41}, {"name": "a", "weight_kg": 31}, {"name": "a", "suit": "wetsuit"}])
def test_gear_presets_reject_bad_values(client, body):
    assert client.post("/gear-presets", json=body).status_code == 422


def test_gear_presets_are_private(client, anon_client):
    from conftest import sign_up

    preset = client.post("/gear-presets", json={"name": "Mine"}).json()
    other = sign_up(anon_client, email="other@example.com")
    assert anon_client.get("/gear-presets", headers=other).json() == []
    assert anon_client.put(f"/gear-presets/{preset['id']}", json={"name": "Theirs"}, headers=other).status_code == 404
    assert anon_client.delete(f"/gear-presets/{preset['id']}", headers=other).status_code == 404
    # Two divers can use the same name
    assert anon_client.post("/gear-presets", json={"name": "Mine"}, headers=other).status_code == 201
