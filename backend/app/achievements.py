"""Achievements: each one unlocks a sea creature for the background ocean.

They're worked out from the diver's whole logbook on every
read, oldest dive first, so they follow the current settings. Each is earned
on the first dive that reaches it. The rarer the tier, the more it takes.

Some come from certification cards instead, earned when the card is added.
Dive photos don't exist yet; the creature that needs them is listed with
coming_soon set and can't be earned until they do. Nothing here rewards
going deeper than the diver is trained for.
"""
from dataclasses import dataclass, field
from datetime import datetime

from .certs import CardFacts

TIERS = ("common", "uncommon", "rare", "epic", "legendary")
KELVIN = 273.15
PHOTOS = "dive photos"


@dataclass(frozen=True)
class Creature:
    key: str
    name: str
    tier: str
    goal: str
    coming_soon: str | None = None  # the feature it needs, until it exists
    secret: bool = False


CREATURES: list[Creature] = [
    # Common: first steps
    Creature("clownfish", "Clownfish", "common", "Log your first dive."),
    Creature("sergeant_major", "Sergeant major", "common", "Log 3 dives."),
    Creature("hermit_crab", "Hermit crab", "common", "Log your gear and weights on a dive."),
    Creature("starfish", "Starfish", "common", "Name a dive site."),
    Creature("blue_tang", "Blue tang", "common", "Write notes on a dive."),
    Creature("butterflyfish", "Butterflyfish", "common", "Note 3 different kinds of sea life."),
    Creature("cleaner_shrimp", "Cleaner shrimp", "common", "Add your tank pressures and get an air score."),
    Creature("pufferfish", "Pufferfish", "common", "Make two dives in one day."),
    Creature("moon_jellyfish", "Moon jellyfish", "common", "Find a thermocline."),
    Creature("bluegill", "Bluegill", "common", "Dive in fresh water."),
    Creature("sea_urchin", "Sea urchin", "common", "Hold a safety stop for the full time."),
    Creature("scuba_diver", "Scuba diver", "common", "Upload your Open Water card."),
    # Uncommon: building skills
    Creature("seahorse", "Seahorse", "uncommon", "5 clean ascents in a row."),
    Creature("octopus", "Octopus", "uncommon", "3 solid safety stops in a row."),
    Creature("green_turtle", "Green sea turtle", "uncommon", "Log 5 dives."),
    Creature("parrotfish", "Parrotfish", "uncommon", "Spend 5 hours underwater."),
    Creature("moray_eel", "Moray eel", "uncommon", "Score 85 or more overall."),
    Creature("cuttlefish", "Cuttlefish", "uncommon", "Score 90 or more for buoyancy."),
    Creature("nudibranch", "Nudibranch", "uncommon", "Note 10 different kinds of sea life."),
    Creature("stingray", "Southern stingray", "uncommon", "Dive 3 different sites."),
    Creature("barracuda", "Barracuda", "uncommon", "Log 10 dives."),
    Creature("goliath_grouper", "Goliath grouper", "uncommon", "Make a dive of 60 minutes or more."),
    Creature("cleaner_wrasse", "Cleaner wrasse", "uncommon", "Meet a goal from your debrief."),
    Creature("largemouth_bass", "Largemouth bass", "uncommon", "Make 5 fresh-water dives."),
    Creature("crayfish", "Crayfish", "uncommon", "Dive in water of 10 °C (50 °F) or colder."),
    Creature("lionfish", "Lionfish", "uncommon", "Add your first dive photo.", coming_soon=PHOTOS),
    # Rare: a committed diver
    Creature("manta_ray", "Manta ray", "rare", "Log 25 dives."),
    Creature("eagle_ray", "Spotted eagle ray", "rare", "Spend 10 hours underwater."),
    Creature("blacktip_shark", "Blacktip reef shark", "rare", "Upload your Advanced Open Water card."),
    Creature("dolphins", "Bottlenose dolphins", "rare", "Make 10 dives with a buddy noted."),
    Creature("sea_lion", "California sea lion", "rare", "Dive 5 different sites."),
    Creature("frogfish", "Frogfish", "rare", "Note 25 different kinds of sea life."),
    Creature("mandarinfish", "Mandarinfish", "rare", "Make a night dive."),
    Creature("leafy_seadragon", "Leafy seadragon", "rare", "10 clean ascents in a row."),
    Creature("spanish_dancer", "Spanish dancer", "rare", "Score 90 or more for buoyancy on 3 dives in a row."),
    Creature("napoleon_wrasse", "Napoleon wrasse", "rare", "Score 85 or more overall on 10 dives."),
    Creature("batfish", "Batfish school", "rare", "Note a wreck as a landmark."),
    Creature("garden_eels", "Garden eels", "rare", "Meet 5 goals from your debriefs."),
    Creature("ocean_sunfish", "Ocean sunfish", "rare", "Dive in both salt and fresh water."),
    # Epic: a seasoned diver
    Creature("whale_shark", "Whale shark", "epic", "Log 50 dives."),
    Creature("hammerheads", "Hammerhead school", "epic", "Dive past 25 m with an Advanced or Deep card on file."),
    Creature("orcas", "Orca pod", "epic", "Spend 50 hours underwater."),
    Creature("great_white", "Great white shark", "epic", "Upload your Rescue Diver card."),
    Creature("sea_otter", "Sea otter", "epic", "Dive 10 different sites."),
    Creature("narwhal", "Narwhal", "epic", "Dive in water of 4 °C (39 °F) or colder."),
    Creature("thresher_shark", "Thresher shark", "epic", "25 dives in a row with a safety stop."),
    Creature("leatherback", "Leatherback turtle", "epic", "Dive in all four seasons."),
    Creature("plankton", "Glowing plankton", "epic", "Make 5 night dives."),
    Creature("research_sub", "Research submarine", "epic", "Upload 3 certification cards."),
    # Legendary: years of diving
    Creature("blue_whale", "Blue whale", "legendary", "Log 100 dives."),
    Creature("giant_octopus", "Giant Pacific octopus", "legendary", "Spend 100 hours underwater."),
    Creature("oarfish", "Oarfish", "legendary", "Score a perfect 100 overall."),
    Creature("anglerfish", "Anglerfish", "legendary", "Make 25 night dives."),
    Creature("coelacanth", "Coelacanth", "legendary", "Log 250 dives."),
    Creature("submersible", "Deep-sea submersible", "legendary", "Upload a Divemaster card, or higher."),
    Creature("golden_manta", "Golden manta", "legendary", "Earn every Rare creature."),
    Creature("kraken", "The Kraken", "legendary", "Earn every other creature.", secret=True),
]
BY_KEY = {c.key: c for c in CREATURES}


@dataclass(frozen=True)
class DiveFacts:
    """What the achievements need to know about one dive."""

    id: int
    started_at: datetime
    duration_s: float
    max_depth_m: float
    site_id: int | None
    site_named: bool
    overall: int | None
    scores: dict[str, int | None]
    regions: dict[str, list[dict]]
    metrics: dict[str, dict]
    water_type: str | None  # salt | fresh: the site's if set, else the dive computer's
    min_temp_k: float | None
    latitude: float | None
    has_notes: bool  # wrote something or rated the dive
    sea_life: list[str] = field(default_factory=list)
    landmarks: list[str] = field(default_factory=list)
    buddy: str | None = None
    weight_logged: bool = False
    thermocline: bool = False
    goal_met: bool = False  # met the previous dive's focus (app.debrief)
    repeat: bool = False  # not the day's first dive
    night: bool = False
    solid_stop: bool = False  # held the full time without drifting off (app.debrief)


@dataclass(frozen=True)
class Progress:
    earned_dive_id: int | None
    earned_at: datetime | None
    progress: int
    target: int

    @property
    def earned(self) -> bool:
        return self.earned_at is not None


def _season(d: DiveFacts) -> int:
    """0 winter ... 3 autumn, flipped south of the equator."""
    season = (d.started_at.month % 12) // 3
    return (season + 2) % 4 if (d.latitude or 0) < 0 else season


def compute_achievements(
    dives: list[DiveFacts], stop_target_s: int, cards: list[CardFacts] | None = None
) -> dict[str, Progress]:
    dives = sorted(dives, key=lambda d: d.started_at)
    cards = sorted(cards or [], key=lambda c: c.added_at)
    out: dict[str, Progress] = {}

    def running(key, target, value):
        """value(dive) adds to a running total; earned when the total reaches target."""
        total = 0.0
        for d in dives:
            total += value(d)
            if total >= target:
                out[key] = Progress(d.id, d.started_at, target, target)
                return
        out[key] = Progress(None, None, int(total), target)

    def first(key, test):
        running(key, 1, lambda d: 1 if test(d) else 0)

    def streak(key, target, applies, passes):
        """target dives in a row that pass, counting only dives it applies to."""
        run = best = 0
        for d in dives:
            if not applies(d):
                continue
            run = run + 1 if passes(d) else 0
            best = max(best, run)
            if run >= target:
                out[key] = Progress(d.id, d.started_at, target, target)
                return
        out[key] = Progress(None, None, best, target)

    def distinct(key, target, values):
        """target different values, from values(dive), ignoring case."""
        seen: set = set()

        def new(d):
            added = set(values(d)) - seen
            seen.update(added)
            return len(added)

        running(key, target, new)

    def species(d):
        return [s.casefold() for s in d.sea_life]

    def sites(d):
        return [d.site_id] if d.site_id is not None else []

    def clean_ascent(d):
        return d.scores.get("ascent") is not None and not [
            r for r in d.regions.get("ascent", []) if r["severity"] in ("warning", "violation")
        ]

    def has(skill):
        return lambda d: d.scores.get(skill) is not None

    def cold(limit_c):
        return lambda d: d.min_temp_k is not None and d.min_temp_k - KELVIN <= limit_c

    hours = lambda d: d.duration_s / 3600  # noqa: E731
    fresh = lambda d: d.water_type == "fresh"  # noqa: E731

    # Common
    running("clownfish", 1, lambda d: 1)
    running("sergeant_major", 3, lambda d: 1)
    first("hermit_crab", lambda d: d.weight_logged)
    first("starfish", lambda d: d.site_named)
    first("blue_tang", lambda d: d.has_notes)
    distinct("butterflyfish", 3, species)
    first("cleaner_shrimp", has("air"))
    first("pufferfish", lambda d: d.repeat)
    first("moon_jellyfish", lambda d: d.thermocline)
    first("bluegill", fresh)
    first("sea_urchin", lambda d: bool(d.scores.get("stop")) and d.metrics.get("stop", {}).get("held_s", 0) >= stop_target_s)
    # Uncommon
    streak("seahorse", 5, has("ascent"), clean_ascent)
    streak("octopus", 3, has("stop"), lambda d: d.solid_stop)
    running("green_turtle", 5, lambda d: 1)
    running("parrotfish", 5, hours)
    first("moray_eel", lambda d: (d.overall or 0) >= 85)
    first("cuttlefish", lambda d: (d.scores.get("buoyancy") or 0) >= 90)
    distinct("nudibranch", 10, species)
    distinct("stingray", 3, sites)
    running("barracuda", 10, lambda d: 1)
    first("goliath_grouper", lambda d: d.duration_s >= 60 * 60)
    first("cleaner_wrasse", lambda d: d.goal_met)
    running("largemouth_bass", 5, lambda d: 1 if fresh(d) else 0)
    first("crayfish", cold(10))
    # Rare
    running("manta_ray", 25, lambda d: 1)
    running("eagle_ray", 10, hours)
    running("dolphins", 10, lambda d: 1 if d.buddy else 0)
    distinct("sea_lion", 5, sites)
    distinct("frogfish", 25, species)
    first("mandarinfish", lambda d: d.night)
    streak("leafy_seadragon", 10, has("ascent"), clean_ascent)
    streak("spanish_dancer", 3, has("buoyancy"), lambda d: (d.scores.get("buoyancy") or 0) >= 90)
    running("napoleon_wrasse", 10, lambda d: 1 if (d.overall or 0) >= 85 else 0)
    first("batfish", lambda d: any("wreck" in m.casefold() for m in d.landmarks))
    running("garden_eels", 5, lambda d: 1 if d.goal_met else 0)
    distinct("ocean_sunfish", 2, lambda d: [d.water_type] if d.water_type else [])
    # Epic
    running("whale_shark", 50, lambda d: 1)
    running("orcas", 50, hours)
    distinct("sea_otter", 10, sites)
    first("narwhal", cold(4))
    streak("thresher_shark", 25, has("stop"), lambda d: bool(d.scores.get("stop")))
    distinct("leatherback", 4, lambda d: [_season(d)])
    running("plankton", 5, lambda d: 1 if d.night else 0)
    # Legendary
    running("blue_whale", 100, lambda d: 1)
    running("giant_octopus", 100, hours)
    first("oarfish", lambda d: (d.overall or 0) >= 100)
    running("anglerfish", 25, lambda d: 1 if d.night else 0)
    running("coelacanth", 250, lambda d: 1)

    # Cards: earned when the card is added, so they link to no dive.
    # A higher card counts for the ones below it.
    def card(key, test, target=1):
        matching = [c for c in cards if test(c)]
        if len(matching) >= target:
            out[key] = Progress(None, matching[target - 1].added_at, target, target)
        else:
            out[key] = Progress(None, None, len(matching), target)

    card("scuba_diver", lambda c: c.rank >= 1)
    card("blacktip_shark", lambda c: c.rank >= 2)
    card("great_white", lambda c: c.rank >= 3)
    card("submersible", lambda c: c.rank >= 4)
    card("research_sub", lambda c: True, 3)

    # Past 25 m, only on a dive made once trained for it. An undated card is taken on trust.
    def trained_deep(d):
        return any(
            (c.rank >= 2 or c.level == "deep") and (c.certified_on is None or c.certified_on <= d.started_at.date())
            for c in cards
        )

    first("hammerheads", lambda d: d.max_depth_m > 25 and trained_deep(d))

    # Not earnable yet: they need photos
    for c in CREATURES:
        if c.coming_soon:
            out[c.key] = Progress(None, None, 0, 1)

    def all_of(key, keys):
        done = [out[k] for k in keys if out[k].earned]
        if len(done) == len(keys):
            last = max(done, key=lambda p: p.earned_at)
            out[key] = Progress(last.earned_dive_id, last.earned_at, len(keys), len(keys))
        else:
            out[key] = Progress(None, None, len(done), len(keys))

    all_of("golden_manta", [c.key for c in CREATURES if c.tier == "rare"])
    all_of("kraken", [c.key for c in CREATURES if c.key != "kraken"])
    return out
