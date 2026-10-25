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
