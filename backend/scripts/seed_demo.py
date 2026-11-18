"""Create (or refresh) a demo account full of believable dives.

Everything goes through the public API, the same way the app's own uploads
do, so sites, scores and achievements come out exactly as for real dives:

    python scripts/seed_demo.py --api http://localhost:8000
    python scripts/seed_demo.py --api https://divedebrief-api.up.railway.app --reset

The logbook tells a story: a new diver's Open Water checkout dives in a
Florida spring, shore dives at Blue Heron Bridge, an Advanced course in
Cozumel and a Nitrox trip to Bonaire. Buoyancy, ascents and air use get
better over the year, with a couple of honest mistakes along the way.

Profiles are generated with a fixed random seed, so every run makes the same
logbook. --reset deletes the account's uploads, cards and gear presets first.
"""
import argparse
import math
import random
import struct
import sys
import zlib
from dataclasses import dataclass, field

import httpx

DEFAULT_EMAIL = "demo@divedebrief.app"
DEFAULT_PASSWORD = "divedemo2026"
COMPUTER = ("Garmin Descent Mk3i", "DEMO-0001")
SAMPLE_S = 4  # seconds between depth samples
KELVIN = 273.15


# --- The logbook --------------------------------------------------------------


@dataclass
class Location:
    key: str
    name: str
    lat: float
    lon: float
    water: str  # salt | fresh
    surface_c: float
    bottom_c: float
    thermocline_m: float  # depth where the water reaches bottom_c


LOCATIONS = {
    loc.key: loc
    for loc in [
        Location("vortex", "Vortex Spring", 30.7706, -85.9488, "fresh", 21.5, 20.5, 6),
        Location("bhb", "Blue Heron Bridge", 26.7836, -80.0423, "salt", 25.0, 24.0, 5),
        Location("palancar", "Palancar Gardens", 20.3253, -87.0270, "salt", 28.5, 27.0, 15),
        Location("thousand", "1000 Steps", 12.2128, -68.3360, "salt", 28.5, 27.5, 20),
    ]
}


@dataclass
class DivePlan:
    where: str
    start: str  # local wall-clock time, as a dive computer records it
    # (depth m, minutes) legs after the descent, before the ascent
    legs: list[tuple[float, float]]
    descent_m_min: float = 15
    ascent_m_min: float = 8
    stop_min: float = 3.0  # safety stop at 5 m; 0 skips it
    wobble_m: float = 0.4  # how much the diver bobs up and down
    flaw: str | None = None  # "fast_ascent" | "yoyo"
    sac: float = 16  # surface air consumption, L/min
    tank_l: float = 11.1
    start_bar: int = 200
    weight_kg: float = 4
    suit: str = "3mm"
    tank_material: str = "aluminum"
    feeling: int = 4
    vis_m: float = 15
    buddy: str = "Sam"
    sea_life: list[str] = field(default_factory=list)
    landmarks: list[str] = field(default_factory=list)
    text: str = ""
    photos: list[tuple[str, str]] = field(default_factory=list)  # (scene, caption)


DIVES = [
    # Open Water checkout, Vortex Spring. Fresh water, thick suit, lots of lead.
    DivePlan(
        "vortex", "2025-09-13T09:40:00", [(6, 6), (8, 10), (6, 4)],
        descent_m_min=8, ascent_m_min=11, stop_min=2, wobble_m=1.3, flaw="yoyo",
        sac=24, tank_l=12, start_bar=210, weight_kg=9, suit="7mm", tank_material="steel",
        feeling=3, vis_m=20, buddy="Instructor Maria",
        sea_life=["Bluegill", "Catfish"], landmarks=["Training platform", "Cave grate"],
        text="Open Water checkout dive 1. Mask clearing and regulator recovery on the "
        "platform. Way overweighted and kept dumping and adding air, but the water is "
        "crystal clear and 21°C year round.",
    ),
    DivePlan(
        "vortex", "2025-09-13T13:15:00", [(9, 8), (10, 10), (7, 6)],
        descent_m_min=9, ascent_m_min=10, stop_min=3, wobble_m=1.0,
        sac=22, tank_l=12, start_bar=210, weight_kg=8, suit="7mm", tank_material="steel",
        feeling=4, vis_m=20, buddy="Instructor Maria",
        sea_life=["Bluegill", "Freshwater eel"], landmarks=["Training platform", "Spring boil"],
        text="Dive 2: CESA practice and a compass swim. Dropped a kilo and it already "
        "felt easier. Saw an eel tucked under the ledge by the spring boil.",
        photos=[("spring", "Looking up from the spring boil")],
    ),
    DivePlan(
        "vortex", "2025-09-14T10:05:00", [(11, 10), (12, 12), (8, 8)],
        descent_m_min=10, ascent_m_min=9, stop_min=3, wobble_m=0.8,
        sac=21, tank_l=12, start_bar=210, weight_kg=8, suit="7mm", tank_material="steel",
        feeling=5, vis_m=22, buddy="Instructor Maria",
        sea_life=["Bluegill", "Catfish", "Turtle"], landmarks=["Cave grate", "Spring boil"],
        text="Last checkout dive. Certified! Hovered for a full minute on the platform "
        "without touching anything. A turtle cruised by on the ascent.",
    ),
    # Shore diving at Blue Heron Bridge: shallow, long and full of critters.
    DivePlan(
        "bhb", "2025-12-06T08:20:00", [(5, 15), (6, 18), (4, 14)],
        descent_m_min=6, ascent_m_min=7, stop_min=0, wobble_m=0.7,
        sac=17, start_bar=200, weight_kg=6, suit="5mm",
        feeling=4, vis_m=8, buddy="Sam",
        sea_life=["Octopus", "Seahorse", "Spotted moray", "Batfish"],
        landmarks=["Bridge pilings", "Snorkel trail"],
        text="First dive at the Bridge, timed for high slack tide. Only 6 m deep, so no "
        "safety stop needed. Sam found a seahorse on the snorkel trail and an octopus "
        "was hunting under the pilings.",
        photos=[("reef", "Octopus under the bridge pilings")],
    ),
    DivePlan(
        "bhb", "2026-02-21T09:10:00", [(6, 18), (7, 20), (5, 15)],
        descent_m_min=6, ascent_m_min=7, stop_min=0, wobble_m=0.5,
        sac=16, start_bar=200, weight_kg=6, suit="5mm",
        feeling=5, vis_m=10, buddy="Sam",
        sea_life=["Batfish", "Flying gurnard", "Seahorse", "Nudibranch"],
        landmarks=["Bridge pilings", "Swim area"],
        text="Batfish walking across the sand! Water was a chilly 24°C so I wore the "
        "5 mm. Trim felt much flatter this time.",
    ),
    DivePlan(
        "bhb", "2026-02-21T13:45:00", [(5, 14), (6, 14), (4, 10)],
        descent_m_min=6, ascent_m_min=7, stop_min=0, wobble_m=0.5,
        sac=19, start_bar=200, weight_kg=6, suit="5mm",
        feeling=3, vis_m=5, buddy="Sam",
        sea_life=["Spotted moray", "Sergeant major"], landmarks=["Swim area"],
        text="Second dive missed slack and the visibility dropped to about 5 m as the "
        "tide turned. Cut it short and practised navigation instead.",
    ),
    # Advanced Open Water in Cozumel: deeper drift dives.
    DivePlan(
        "palancar", "2026-04-11T09:00:00", [(24, 7), (18, 12), (14, 8)],
        descent_m_min=18, ascent_m_min=12, stop_min=3, wobble_m=0.6, flaw="fast_ascent",
        sac=18, start_bar=207, weight_kg=4, suit="3mm",
        feeling=4, vis_m=30, buddy="Divemaster Luis",
        sea_life=["Hawksbill turtle", "Splendid toadfish", "Barracuda"],
        landmarks=["Coral towers", "Swim-through"],
        text="Advanced deep dive: 24 m. The current was stronger than expected, and I "
        "shot up from 10 m too fast when I lost my reference. Luis signalled me to "
        "slow down. Lesson learned: dump air before you rise, not after.",
        photos=[("reef", "Coral towers at Palancar Gardens")],
    ),
    DivePlan(
        "palancar", "2026-04-11T12:30:00", [(16, 10), (14, 15), (12, 8)],
        descent_m_min=15, ascent_m_min=8, stop_min=3, wobble_m=0.4,
        sac=16, start_bar=207, weight_kg=4, suit="3mm",
        feeling=5, vis_m=30, buddy="Divemaster Luis",
        sea_life=["Hawksbill turtle", "Eagle ray", "Queen angelfish"],
        landmarks=["Coral towers", "Sand channel"],
        text="Peak performance buoyancy adventure dive. Drifted the whole way without "
        "touching the fins once. An eagle ray glided under us in the sand channel.",
    ),
    DivePlan(
        "palancar", "2026-04-12T09:20:00", [(22, 8), (17, 13), (13, 10)],
        descent_m_min=16, ascent_m_min=8, stop_min=3.5, wobble_m=0.35,
        sac=15, start_bar=207, weight_kg=4, suit="3mm",
        feeling=5, vis_m=35, buddy="Divemaster Luis",
        sea_life=["Nurse shark", "Splendid toadfish", "Lobster"],
        landmarks=["Swim-through", "Coral towers"],
        text="Final Advanced dive, so I'm Advanced Open Water now. A nurse shark was "
        "sleeping under an overhang. Nailed the ascent this time: slow and steady, "
        "with a solid stop.",
        photos=[("shark", "Nurse shark resting under an overhang")],
    ),
    # Bonaire shore diving on nitrox.
    DivePlan(
        "thousand", "2026-08-15T08:30:00", [(26, 7), (18, 14), (10, 12)],
        descent_m_min=15, ascent_m_min=8, stop_min=3, wobble_m=0.3,
        sac=13.5, start_bar=200, weight_kg=3, suit="shorty",
        feeling=5, vis_m=30, buddy="Sam",
        sea_life=["Frogfish", "Tarpon", "Parrotfish"], landmarks=["Reef wall", "Sand chute"],
        text="First nitrox dive (EAN32). Actually 72 steps down to the entry, not 1000. "
        "Found a yellow frogfish at 18 m on the wall.",
    ),
    DivePlan(
        "thousand", "2026-08-16T08:15:00", [(28, 6), (20, 13), (12, 12)],
        descent_m_min=16, ascent_m_min=8, stop_min=3, wobble_m=0.3,
        sac=13, start_bar=200, weight_kg=3, suit="shorty",
        feeling=4, vis_m=28, buddy="Sam",
        sea_life=["Tarpon", "Moray eel", "Trumpetfish"], landmarks=["Reef wall"],
        text="Deepest dive yet at 28 m on EAN32. Tarpon hung in the blue the whole "
        "time. My air consumption is half what it was at Vortex Spring.",
        photos=[("blue", "Tarpon off the wall at 1000 Steps")],
    ),
    DivePlan(
        "thousand", "2026-08-17T15:40:00", [(18, 12), (14, 15), (9, 13)],
        descent_m_min=14, ascent_m_min=7, stop_min=4, wobble_m=0.25,
        sac=12.5, start_bar=200, weight_kg=3, suit="shorty",
        feeling=5, vis_m=30, buddy="Sam",
        sea_life=["Sea turtle", "Parrotfish", "Squid"], landmarks=["Reef wall", "Sand chute"],
        text="Lazy afternoon dive to finish the trip. A turtle let us swim alongside it "
        "for five minutes. Smoothest dive of the year.",
    ),
]

CARDS = [
    {"agency": "PADI", "level": "open_water", "number": "2509DEMO0142", "certified_on": "2025-09-14"},
    {"agency": "PADI", "level": "advanced", "number": "2604DEMO0877", "certified_on": "2026-04-12"},
    {"agency": "SSI", "level": "nitrox", "title": "Enriched Air Nitrox", "number": "SSI-DEMO-55310", "certified_on": "2026-08-14"},
]

PRESETS = [
    {"name": "Tropical", "weight_kg": 3, "suit": "shorty", "tank_material": "aluminum"},
    {"name": "Florida winter", "weight_kg": 6, "suit": "5mm", "tank_material": "aluminum"},
    {"name": "Springs", "weight_kg": 8, "suit": "7mm", "tank_material": "steel"},
]


# --- Profiles -----------------------------------------------------------------


def profile(plan: DivePlan, rng: random.Random) -> list[tuple[float, float]]:
    """(time s, depth m) every SAMPLE_S seconds, from the plan's legs."""
    points: list[tuple[float, float]] = [(0.0, 0.0)]  # (t, target depth) way-points

    def move_to(depth: float, rate_m_min: float) -> None:
        t, d = points[-1]
        points.append((t + abs(depth - d) / rate_m_min * 60, depth))

    def stay(minutes: float) -> None:
        t, d = points[-1]
        points.append((t + minutes * 60, d))

    first_depth, _ = plan.legs[0]
    move_to(first_depth, plan.descent_m_min)
    for depth, minutes in plan.legs:
        move_to(depth, 10 if depth > points[-1][1] else 6)
        stay(minutes)
    if plan.flaw == "fast_ascent":
        move_to(10, plan.ascent_m_min)
        move_to(4, 20)  # lost the reference and rose too fast
        move_to(5, 4)
    else:
        move_to(5, plan.ascent_m_min)
    if plan.stop_min:
        stay(plan.stop_min)
    move_to(0, 5)

    end = points[-1][0]
    phase = rng.uniform(0, 2 * math.pi)
    out = []
    t = 0.0
    while t <= end:
        d = _interp(points, t)
        bottom = d > 2 and 30 < t < end - 30
        if bottom:
            # Breathing and buoyancy wobble, plus a slow drift
            d += plan.wobble_m * (0.6 * math.sin(t / 9 + phase) + 0.4 * math.sin(t / 47 + 2 * phase))
            d += rng.gauss(0, plan.wobble_m * 0.08)
            if plan.flaw == "yoyo" and 600 < t < 900:
                d -= 2.5 * max(0.0, math.sin((t - 600) / 300 * math.pi))
        out.append((t, round(max(0.0, d), 2)))
        t += SAMPLE_S
    if out[-1][1] != 0:
        out.append((out[-1][0] + SAMPLE_S, 0.0))
    return out


def _interp(points: list[tuple[float, float]], t: float) -> float:
    for (t0, d0), (t1, d1) in zip(points, points[1:]):
        if t0 <= t <= t1:
            return d0 if t1 == t0 else d0 + (d1 - d0) * (t - t0) / (t1 - t0)
    return points[-1][1]


def temperature_k(loc: Location, depth: float) -> float:
    frac = min(1.0, depth / loc.thermocline_m)
    return round(loc.surface_c - (loc.surface_c - loc.bottom_c) * frac + KELVIN, 2)


def end_pressure(plan: DivePlan, samples: list[tuple[float, float]], loc: Location) -> int:
    metres_per_atm = 10.3 if loc.water == "salt" else 10.6
    litres = sum(
        plan.sac * (d / metres_per_atm + 1) * (t1 - t0) / 60
        for (t0, d), (t1, _) in zip(samples, samples[1:])
    )
    end = round(plan.start_bar - litres / plan.tank_l)
    if end < 40:
        raise ValueError(f"{plan.start} would end at {end} bar; shorten it or lower its SAC")
    return end


# --- UDDF ---------------------------------------------------------------------


def uddf(plans: list[tuple[DivePlan, list[tuple[float, float]], tuple[float, float]]], loc: Location) -> bytes:
    model, serial = COMPUTER
    sites, dives = [], []
    for i, (plan, samples, (lat, lon)) in enumerate(plans, start=1):
        sites.append(
            f'<site id="site{i}"><name>{loc.name}</name><geography>'
            f"<latitude>{lat:.6f}</latitude><longitude>{lon:.6f}</longitude></geography></site>"
        )
        waypoints = "".join(
            f"<waypoint><divetime>{t:g}</divetime><depth>{d}</depth>"
            f"<temperature>{temperature_k(loc, d)}</temperature></waypoint>"
            for t, d in samples
        )
        dives.append(
            f'<dive id="dive{i}"><informationbeforedive><link ref="site{i}"/>'
            f"<datetime>{plan.start}</datetime></informationbeforedive>"
            f"<samples>{waypoints}</samples></dive>"
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<uddf xmlns="http://www.streit.cc/uddf/3.2/" version="3.2.0">'
        "<generator><name>DiveDebrief demo seed</name></generator>"
        f'<diver><owner id="owner"><equipment><divecomputer id="dc">'
        f"<model>{model}</model><serialnumber>{serial}</serialnumber>"
        "</divecomputer></equipment></owner></diver>"
        f"<divesite>{''.join(sites)}</divesite>"
        f"<profiledata><repetitiongroup id=\"rg\">{''.join(dives)}</repetitiongroup></profiledata>"
        "</uddf>"
    ).encode()


# --- Photos (drawn in code, so the script needs nothing but httpx) -------------


def png(width: int, height: int, pixel) -> bytes:
    rows = bytearray()
    for y in range(height):
        rows.append(0)
        for x in range(width):
            rows.extend(pixel(x, y))

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + chunk(b"IEND", b"")
    )


def scene(kind: str, seed: int, w: int = 720, h: int = 480) -> bytes:
    """A simple underwater picture: water, light rays, sand, and things in it."""
    rng = random.Random(seed)
    tops = {"spring": (120, 220, 215), "reef": (70, 170, 210), "shark": (50, 130, 190), "blue": (30, 110, 190)}
    top = tops[kind]
    deep = (8, 40, 90) if kind != "spring" else (20, 90, 110)
    sand_y = {"spring": 0.78, "reef": 0.72, "shark": 0.76, "blue": 1.1}[kind] * h
    fish = [(rng.uniform(0.1, 0.9) * w, rng.uniform(0.15, 0.6) * h, rng.uniform(10, 26), rng.choice([-1, 1]),
             rng.choice([(250, 200, 60), (240, 120, 70), (230, 230, 240), (120, 200, 250)]))
            for _ in range({"spring": 3, "reef": 9, "shark": 4, "blue": 6}[kind])]
    big = (0.5 * w, 0.62 * h, 120) if kind == "shark" else None
    corals = [(rng.uniform(0, w), rng.uniform(25, 70), rng.choice([(200, 90, 110), (230, 150, 80), (150, 110, 190)]))
              for _ in range(14 if kind in ("reef", "shark") else 0)]
    bubbles = [(rng.uniform(0, w), rng.uniform(0, h), rng.uniform(2, 6)) for _ in range(25)]

    def pixel(x: int, y: int) -> tuple[int, int, int]:
        f = y / h
        r, g, b = (top[i] + (deep[i] - top[i]) * f for i in range(3))
        ray = max(0.0, math.sin((x + y * 0.35) / 38)) ** 8 * (1 - f) * 40
        r, g, b = r + ray, g + ray, b + ray
        if y > sand_y + 6 * math.sin(x / 50):
            k = 0.85 + 0.15 * math.sin(x / 7 + y / 5)
            r, g, b = 200 * k * (1 - f * 0.4), 185 * k * (1 - f * 0.4), 140 * k * (1 - f * 0.3)
        for cx, ch, col in corals:
            if abs(x - cx) < 10 + ch / 4 and sand_y - ch < y < sand_y + 10 and math.sin(x / 3 + cx) > -0.3:
                r, g, b = col
        if big:
            bx, by, bl = big
            dx, dy = (x - bx) / bl, (y - by) / (bl * 0.28)
            if dx * dx + dy * dy < 1 or (bl * 0.9 < x - bx < bl * 1.4 and abs(y - by) < (x - bx - bl * 0.9) * 0.6):
                r, g, b = 120, 110, 95
        for fx, fy, size, facing, col in fish:
            dx, dy = (x - fx) / size, (y - fy) / (size * 0.45)
            tail = -facing * (x - fx) / size
            if dx * dx + dy * dy < 1 or (1.0 < tail < 1.6 and abs(y - fy) < (tail - 0.9) * size * 0.6):
                r, g, b = col
        for bx, by, br in bubbles:
            if abs(math.hypot(x - bx, y - by) - br) < 0.9:
                r, g, b = r + 60, g + 60, b + 60
        return tuple(int(max(0, min(255, c))) for c in (r, g, b))

    return png(w, h, pixel)


# --- Talking to the API -------------------------------------------------------


def sign_in(api: httpx.Client, email: str, password: str) -> None:
    r = api.post("/auth/register", json={"email": email, "password": password})
    if r.status_code not in (201, 409):
        sys.exit(f"Couldn't register {email}: {r.status_code} {r.text}")
    print("Created account" if r.status_code == 201 else "Account already exists", email)
    r = api.post("/auth/login", data={"username": email, "password": password})
    if r.status_code != 200:
        sys.exit(f"Couldn't sign in as {email}: {r.status_code} {r.text}")
    api.headers["Authorization"] = f"Bearer {r.json()['access_token']}"


def reset(api: httpx.Client) -> None:
    for u in ok(api.get("/uploads")):
        ok(api.delete(f"/uploads/{u['id']}"))
    for c in ok(api.get("/cards")):
        ok(api.delete(f"/cards/{c['id']}"))
    for p in ok(api.get("/gear-presets")):
        ok(api.delete(f"/gear-presets/{p['id']}"))
    print("Cleared the existing logbook, cards and gear presets")


def ok(r: httpx.Response):
    if r.status_code >= 400:
        sys.exit(f"{r.request.method} {r.request.url.path} failed: {r.status_code} {r.text}")
    return r.json() if r.content else None


def seed(api: httpx.Client) -> None:
    rng = random.Random(2026)
    by_start: dict[str, DivePlan] = {}
    samples: dict[str, list[tuple[float, float]]] = {}
    for key, loc in LOCATIONS.items():
        plans = []
        for plan in (p for p in DIVES if p.where == key):
            # Entry points within ~40 m of each other, so they group into one site
            pos = (loc.lat + rng.uniform(-3e-4, 3e-4), loc.lon + rng.uniform(-3e-4, 3e-4))
            samples[plan.start] = profile(plan, rng)
            plans.append((plan, samples[plan.start], pos))
            by_start[plan.start] = plan
        result = ok(api.post("/uploads", files={"file": (f"{key}.uddf", uddf(plans, loc), "application/xml")}))
        print(f"Uploaded {loc.name}: {result['added']} added, {result['skipped']} already there")

    dives = ok(api.get("/dives"))
    for d in dives:
        # Dive computers' local time comes back tagged as UTC
        plan = by_start.get(d["started_at"][:19])
        if plan is None:
            continue
        loc = LOCATIONS[plan.where]
        ok(api.put(f"/dives/{d['id']}/tank", json={
            "volume_l": plan.tank_l, "start_bar": plan.start_bar, "end_bar": end_pressure(plan, samples[plan.start], loc),
        }))
        ok(api.put(f"/dives/{d['id']}/gear", json={
            "weight_kg": plan.weight_kg, "suit": plan.suit, "tank_material": plan.tank_material,
        }))
        ok(api.put(f"/dives/{d['id']}/notes", json={
            "feeling": plan.feeling, "sea_life": plan.sea_life, "landmarks": plan.landmarks,
            "text": plan.text, "visibility_m": plan.vis_m, "buddy": plan.buddy,
        }))
        existing = ok(api.get(f"/dives/{d['id']}/photos"))
        for i, (kind, caption) in enumerate(plan.photos[len(existing):]):
            image = scene(kind, seed=zlib.crc32(f"{plan.start}#{i}".encode()))
            ok(api.post(f"/dives/{d['id']}/photos", files={"file": ("photo.png", image, "image/png")},
                        data={"caption": caption}))
    print(f"Added tanks, gear, notes and photos to {len(by_start)} dives")

    for site in ok(api.get("/sites"))["sites"]:
        loc = min(LOCATIONS.values(), key=lambda l: (l.lat - site["latitude"]) ** 2 + (l.lon - site["longitude"]) ** 2)
        ok(api.put(f"/sites/{site['id']}", json={"name": loc.name, "water_type": loc.water}))
    print("Named the sites")

    have = {(c["agency"], c["level"]) for c in ok(api.get("/cards"))}
    for card in CARDS:
        if (card["agency"], card["level"]) not in have:
            ok(api.post("/cards", json=card))
    have = {p["name"] for p in ok(api.get("/gear-presets"))}
    for preset in PRESETS:
        if preset["name"] not in have:
            ok(api.post("/gear-presets", json=preset))
    print(f"Added {len(CARDS)} certification cards and {len(PRESETS)} gear presets")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--api", default="http://localhost:8000", help="API base URL")
    ap.add_argument("--email", default=DEFAULT_EMAIL)
    ap.add_argument("--password", default=DEFAULT_PASSWORD)
    ap.add_argument("--reset", action="store_true", help="delete the account's dives, cards and presets first")
    args = ap.parse_args()

    with httpx.Client(base_url=args.api.rstrip("/"), timeout=120) as api:
        sign_in(api, args.email, args.password)
        if args.reset:
            reset(api)
        seed(api)
    print(f"Done. Sign in as {args.email} / {args.password}")


if __name__ == "__main__":
    main()
