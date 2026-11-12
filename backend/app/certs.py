"""Certification cards: the levels a card can be, and how they rank.

A card's level unlocks the creatures for that training (app.achievements).
Agencies name their courses differently (SSI's Advanced Adventurer is
PADI's Advanced Open Water), so the diver picks the closest level.
"""
from dataclasses import dataclass
from datetime import date, datetime

# key -> (label, rank). Rank orders the core recreational path; a higher card
# implies the ones below it. Specialties rank 0.
LEVELS: dict[str, tuple[str, int]] = {
    "open_water": ("Open Water", 1),
    "advanced": ("Advanced Open Water", 2),
    "rescue": ("Rescue Diver", 3),
    "divemaster": ("Divemaster", 4),
    "instructor": ("Instructor", 5),
    "deep": ("Deep Diver", 0),
    "nitrox": ("Enriched Air (Nitrox)", 0),
    "other": ("Other", 0),
}

@dataclass(frozen=True)
class CardFacts:
    """What the achievements need to know about one card."""

    level: str
    certified_on: date | None
    added_at: datetime

    @property
    def rank(self) -> int:
        return LEVELS.get(self.level, ("", 0))[1]
