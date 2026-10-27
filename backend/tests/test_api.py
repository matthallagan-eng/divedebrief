from pathlib import Path

import pytest

from app.config import settings

FIXTURES = Path(__file__).parent / "fixtures"
SYNTHETIC = FIXTURES / "uddf" / "synthetic"

# One 12 m/min ascent from 20 m to 10 m (see shared/ascent-golden.json)
FAST_ASCENT = b"""<uddf><profiledata><repetitiongroup><dive id="fast">
  <informationbeforedive><datetime>2026-05-01T10:00:00Z</datetime></informationbeforedive>
  <samples>
    <waypoint><divetime>0</divetime><depth>20</depth></waypoint>
    <waypoint><divetime>60</divetime><depth>20</depth></waypoint>
    <waypoint><divetime>110</divetime><depth>10</depth></waypoint>
    <waypoint><divetime>200</divetime><depth>10</depth></waypoint>
  </samples>
</dive></repetitiongroup></profiledata></uddf>"""


def _upload(client, name="single_dive.uddf", content=None):
    if content is None:
        content = (SYNTHETIC / name).read_bytes()
    return client.post("/uploads", files={"file": (name, content, "application/xml")})


def test_upload_stores_dive_with_summary_and_samples(client):
    res = _upload(client)
    assert res.status_code == 200
    body = res.json()
    assert body["added"] == 1 and body["skipped"] == 0
    assert isinstance(body["upload_id"], int)

    [dive] = client.get("/dives").json()
    assert dive["upload_id"] == body["upload_id"]
    assert dive["computer_model"] == "Descent Mk2i"
    assert dive["started_at"].startswith("2026-03-14T09:30:00")

    detail = client.get(f"/dives/{dive['id']}").json()
    assert detail["computer_serial"] == "TEST-0001"
    assert len(detail["samples"]) == 7
    assert detail["samples"][2]["depth_m"] == 18.5


def test_reupload_skips_known_dives_without_creating_upload(client):
    _upload(client)
    body = _upload(client).json()
    assert body == {
        "upload_id": None,
        "filename": "single_dive.uddf",
        "added": 0,
        "updated": 0,
        "skipped": 1,
        "warnings": [],
    }
    assert len(client.get("/uploads").json()) == 1


def test_multi_dive_upload_lists_newest_first(client):
    assert _upload(client, "multi_dive.uddf").json()["added"] == 3
    starts = [d["started_at"] for d in client.get("/dives").json()]
    assert len(starts) == 3
    assert starts == sorted(starts, reverse=True)


def test_same_day_dives_get_a_surface_interval(client):
    _upload(client, "multi_dive.uddf")
    third, second, first = client.get("/dives").json()
    assert (first["dive_of_day"], first["dives_that_day"], first["surface_interval_s"]) == (1, 2, None)
    assert (second["dive_of_day"], second["previous_dive_id"]) == (2, first["id"])
    # 08:00 and 11:00 the same day, less the first dive's length
    assert second["surface_interval_s"] == 3 * 3600 - first["duration_s"]
    assert (third["dive_of_day"], third["dives_that_day"]) == (1, 1)
    assert (first["sea_life"], first["buddy"]) == ([], None)

    detail = client.get(f"/dives/{second['id']}").json()
    assert detail["surface_interval_s"] == second["surface_interval_s"]
    titles = [i["title"] for i in detail["debrief"]["items"]]
    # 12 m after the first dive's 8 m
    assert "Your second dive of the day" in titles and "Deepest dive first" in titles


def test_scores_are_stored_and_returned(client):
    # Hand-derived (10 s window): ascending seconds 58-112, of which 58-62 and
    # 108-112 are within 9 m/min -> 10/55 = 18. No time in the stop band -> 0.
    # Buoyancy: one steady move from 20 m to 10 m and no wobble -> 100.
    _upload(client, "fast.uddf", FAST_ASCENT)
    [dive] = client.get("/dives").json()
    assert [(s["skill"], s["score"]) for s in dive["scores"]] == [
        ("ascent", 18), ("stop", 0), ("buoyancy", 100), ("air", None),
    ]
    assert dive["overall_score"] == 39
    assert dive["scores"][0]["reason"] == (
        "1 segment over 9 m/min, fastest 12 m/min between 19 m and 11 m."
    )

    detail = client.get(f"/dives/{dive['id']}").json()
    [region] = detail["scores"][0]["regions"]
    assert (region["start_s"], region["end_s"], region["severity"]) == (63, 107, "warning")
    assert len(detail["profile"]) == 201
    assert detail["profile"][85]["rate_m_per_min"] == pytest.approx(12)


def test_settings_default_then_update_rescores(client):
    res = client.get("/settings").json()
    assert res["version"] == 0
    assert res["values"] == res["defaults"]
    assert res["values"]["ascent_target_m_per_min"] == 9

    _upload(client, "fast.uddf", FAST_ASCENT)
    new = {**res["values"], "ascent_target_m_per_min": 13}
    put = client.put("/settings", json=new)
    assert put.status_code == 200 and put.json()["version"] == 1

    [dive] = client.get("/dives").json()
    ascent = dive["scores"][0]
    assert ascent["score"] == 100
    assert ascent["reason"] == "All ascent within 13 m/min; fastest 12.0 m/min."
    assert dive["overall_score"] == 67


def test_units_and_difficulty_rescore(client):
    res = client.get("/settings").json()
    assert (res["values"]["units"], res["values"]["difficulty"]) == ("metric", "easy")
    assert res["grading"]["easy"]["ascent_violation_penalty"] == 10
    assert set(res["grading"]) == {"easy", "normal", "hard"}

    _upload(client, "fast.uddf", FAST_ASCENT)
    put = client.put("/settings", json={**res["values"], "units": "imperial", "difficulty": "hard"})
    assert put.status_code == 200
    [dive] = client.get("/dives").json()
    assert "ft/min" in dive["scores"][0]["reason"]


@pytest.mark.parametrize(
    "change",
    [
        {"units": "furlongs"},
        {"difficulty": "nightmare"},
        {"ascent_violation_m_per_min": 8},  # not above the 9 m/min target
        {"stop_band_max_m": 3},  # not deeper than the 3 m band min
        {"ascent_window_s": 1},
        {"unknown_setting": 1},
    ],
)
def test_settings_reject_invalid_values(client, change):
    defaults = client.get("/settings").json()["defaults"]
    assert client.put("/settings", json={**defaults, **change}).status_code == 422
    assert client.get("/settings").json()["version"] == 0


@pytest.mark.parametrize(
    "name, content, message",
    [
        ("dive.tcx", b"<tcx/>", "must be a .fit file"),
        ("bad.uddf", b"<uddf><oops", "Could not parse UDDF"),
        ("bad.fit", b"\x0e\x10", "Could not parse FIT: Not a FIT file"),
    ],
)
def test_upload_rejects_bad_files(client, name, content, message):
    res = _upload(client, name, content)
    assert res.status_code == 400
    assert message in res.json()["detail"]


def test_fit_upload_stores_extra_channels_and_dedupes_with_uddf(client):
    fit = (FIXTURES / "fit" / "real" / "2026-08-09-12-02-28.fit").read_bytes()
    res = client.post("/uploads", files={"file": ("dive.fit", fit, "application/octet-stream")})
    assert res.status_code == 200 and res.json()["added"] == 1

    [dive] = client.get("/dives").json()
    assert dive["computer_model"] == "Garmin Descent G2"
    detail = client.get(f"/dives/{dive['id']}").json()
    assert detail["water_type"] == "fresh"
    assert detail["latitude"] is not None
    assert detail["samples"][0]["heart_rate"] == 81
    assert [s["skill"] for s in detail["scores"]] == ["ascent", "stop", "buoyancy", "air"]

    # The same dive exported from Subsurface is recognised as already stored
    uddf = (FIXTURES / "uddf" / "real" / "test_dive.uddf").read_bytes()
    res = _upload(client, "test_dive.uddf", uddf)
    assert (res.json()["added"], res.json()["skipped"]) == (0, 1)


def test_fit_upload_fills_in_a_dive_stored_from_uddf(client):
    uddf = (FIXTURES / "uddf" / "real" / "test_dive.uddf").read_bytes()
    _upload(client, "test_dive.uddf", uddf)
    [before] = client.get("/dives").json()
    old = client.get(f"/dives/{before['id']}").json()
    # Subsurface exports the site position, but not separate entry and exit points
    assert old["source"] == "uddf" and old["latitude"] == 41.370895
    assert old["exit_latitude"] is None and old["site"] is not None
    assert old["samples"][0]["t_s"] == 1  # Subsurface's 1 s shift

    fit = (FIXTURES / "fit" / "real" / "2026-08-09-12-02-28.fit").read_bytes()
    res = client.post("/uploads", files={"file": ("dive.fit", fit, "application/octet-stream")})
    body = res.json()
    assert (body["added"], body["updated"], body["skipped"], body["upload_id"]) == (0, 1, 0, None)

    [after] = client.get("/dives").json()
    assert (after["id"], after["upload_id"]) == (before["id"], before["upload_id"])
    new = client.get(f"/dives/{after['id']}").json()
    assert new["source"] == "fit"
    assert new["computer_model"] == "Garmin Descent G2"
    assert new["water_type"] == "fresh" and new["latitude"] is not None
    assert new["exit_latitude"] == pytest.approx(41.370896, abs=1e-6)
    assert new["site"]["id"] == old["site"]["id"]
    assert (new["samples"][0]["t_s"], new["samples"][0]["heart_rate"]) == (0, 81)
    # Rescored from the FIT samples (ascent 82 vs 81 from UDDF)
    assert [(s["skill"], s["score"]) for s in new["scores"]] == [
        ("ascent", 82), ("stop", 71), ("buoyancy", 90), ("air", None),
    ]

    # A second FIT upload of the same dive has nothing to add
    res = client.post("/uploads", files={"file": ("dive.fit", fit, "application/octet-stream")})
    assert (res.json()["updated"], res.json()["skipped"]) == (0, 1)


def _square_dive(day: int) -> bytes:
    """50 min at 10 m with instant descent and ascent: duration 3000 s, avg 10 m."""
    return f"""<uddf><profiledata><repetitiongroup><dive id="d{day}">
  <informationbeforedive><datetime>2026-07-{day:02d}T10:00:00</datetime></informationbeforedive>
  <samples>
    <waypoint><divetime>0</divetime><depth>10</depth></waypoint>
    <waypoint><divetime>3000</divetime><depth>10</depth></waypoint>
  </samples>
</dive></repetitiongroup></profiledata></uddf>""".encode()


def _air(dive):
    return next((s["score"], s["reason"]) for s in dive["scores"] if s["skill"] == "air")


def test_tank_entry_and_air_baseline(client):
    for day in range(1, 7):
        _upload(client, f"day{day}.uddf", _square_dive(day))
    dives = sorted(client.get("/dives").json(), key=lambda d: d["started_at"])
    assert _air(dives[0]) == (None, "No tank data. Add your tank and pressures to score air use.")

    # Pressures are required when the dive computer recorded none
    first = dives[0]["id"]
    assert client.put(f"/dives/{first}/tank", json={"volume_l": 10}).status_code == 422
    bad = {"volume_l": 10, "start_bar": 200, "end_bar": 210}
    assert client.put(f"/dives/{first}/tank", json=bad).status_code == 422

    # 10 L, 50 min at 2 ATA: SAC = bar used / 10. Five dives at 17 L/min.
    for d in dives[:5]:
        res = client.put(f"/dives/{d['id']}/tank", json={"volume_l": 10, "start_bar": 200, "end_bar": 30})
        assert res.json() == {"volume_l": 10, "start_bar": 200, "end_bar": 30, "source": "manual"}
    last = dives[5]["id"]
    client.put(f"/dives/{last}/tank", json={"volume_l": 10, "start_bar": 200, "end_bar": 47})

    detail = client.get(f"/dives/{dives[4]['id']}").json()
    assert detail["tank"]["source"] == "manual"
    assert _air(detail) == (None, "17.0 L/min. Building your baseline (4 of 5).")
    # 15.3 vs 17: 10% better -> 90
    assert _air(client.get(f"/dives/{last}").json()) == (90, "15.3 L/min, 10% better than your last 5 dives.")

    # Editing earlier tanks moves the later dive's baseline: with three of the
    # five at 15.3 L/min the median is 15.3, so the last dive is now on par
    for d in dives[:3]:
        client.put(f"/dives/{d['id']}/tank", json={"volume_l": 10, "start_bar": 200, "end_bar": 47})
    after = {d["id"]: d for d in client.get("/dives").json()}
    assert _air(after[last]) == (75, "15.3 L/min, in line with your last 5 dives.")

    assert client.delete(f"/dives/{last}/tank").status_code == 204
    assert client.get(f"/dives/{last}").json()["tank"] is None


def test_upload_rejects_oversized_file(client, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_bytes", 100)
    res = _upload(client)
    assert res.status_code == 400
    assert "too large" in res.json()["detail"]


def test_deleting_upload_removes_its_dives(client):
    upload_id = _upload(client, "multi_dive.uddf").json()["upload_id"]
    assert client.delete(f"/uploads/{upload_id}").status_code == 204
    assert client.get("/dives").json() == []
    assert client.delete(f"/uploads/{upload_id}").status_code == 404


def test_delete_dive(client):
    _upload(client)
    [dive] = client.get("/dives").json()
    assert client.delete(f"/dives/{dive['id']}").status_code == 204
    assert client.get(f"/dives/{dive['id']}").status_code == 404
    assert client.delete(f"/dives/{dive['id']}").status_code == 404


def test_stale_scores_are_recomputed(client, engine):
    from sqlalchemy import text

    from app.scoring import ALGORITHM_VERSION

    _upload(client, "fast.uddf", FAST_ASCENT)
    with engine.begin() as conn:
        # As if scored by an older algorithm that produced different numbers
        conn.execute(text("UPDATE dive_scores SET algorithm_version = 0, score = 77"))
    [dive] = client.get("/dives").json()
    assert dive["scores"][0]["score"] == 18
    with engine.begin() as conn:
        assert conn.scalar(text("SELECT min(algorithm_version) FROM dive_scores")) == ALGORITHM_VERSION
