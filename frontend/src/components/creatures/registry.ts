import type { Tier } from "../../api/types";
import { CREATURE_DRAWINGS, type Drawing } from "./drawings";

// swim: crosses the screen; floor: walks or sits on the reef; drift: rises slowly
export type Zone = "swim" | "floor" | "drift";

export interface CreatureArt {
  drawing: Drawing; // assets/sea/creatures/<key>.svg
  zone: Zone;
  width: number; // px in the background scene
  glow: string; // halo colour for epic and legendary creatures
}

const c = (zone: Zone, width: number, glow: string) => ({ zone, width, glow });

// Keyed like app/achievements.py
const CREATURES: Record<string, Omit<CreatureArt, "drawing">> = {
  clownfish: c("swim", 40, "#f6efe6"),
  sergeant_major: c("swim", 70, "#1d2b33"),
  hermit_crab: c("floor", 46, "#e8c9a0"),
  starfish: c("floor", 34, "#f8c2a8"),
  blue_tang: c("swim", 46, "#f2c230"),
  butterflyfish: c("swim", 38, "#1d2b33"),
  cleaner_shrimp: c("floor", 44, "#f6efe6"),
  pufferfish: c("swim", 44, "#6b5b3a"),
  moon_jellyfish: c("drift", 44, "#e6c9f5"),
  bluegill: c("swim", 44, "#1d3550"),
  sea_urchin: c("floor", 34, "#c4a8f0"),
  scuba_diver: c("swim", 120, "#f2c230"),
  seahorse: c("drift", 26, "#f7d08a"),
  octopus: c("swim", 60, "#f0a090"),
  green_turtle: c("swim", 90, "#a8784a"),
  parrotfish: c("swim", 56, "#e86fa8"),
  moray_eel: c("floor", 90, "#d6e07a"),
  cuttlefish: c("swim", 60, "#f2dcc0"),
  nudibranch: c("floor", 36, "#f5a623"),
  stingray: c("floor", 80, "#c8ccd2"),
  barracuda: c("swim", 100, "#4d5d6a"),
  goliath_grouper: c("swim", 110, "#5a4a32"),
  cleaner_wrasse: c("swim", 36, "#14202e"),
  largemouth_bass: c("swim", 62, "#2e3d1f"),
  crayfish: c("floor", 46, "#e89a7a"),
  lionfish: c("swim", 64, "#f6efe6"),
  manta_ray: c("swim", 180, "#e6eef5"),
  eagle_ray: c("swim", 130, "#f2f5f8"),
  blacktip_shark: c("swim", 150, "#141c22"),
  dolphins: c("swim", 200, "#d6e2ea"),
  sea_lion: c("swim", 120, "#d8c0a0"),
  frogfish: c("floor", 44, "#a8641e"),
  mandarinfish: c("swim", 40, "#f28c38"),
  leafy_seadragon: c("drift", 90, "#8fb35a"),
  spanish_dancer: c("swim", 70, "#f6d6d0"),
  napoleon_wrasse: c("swim", 130, "#1f5f9a"),
  batfish: c("swim", 110, "#3a3a33"),
  garden_eels: c("floor", 90, "#4a4a40"),
  ocean_sunfish: c("swim", 110, "#8b97a3"),
  whale_shark: c("swim", 340, "#e6eef5"),
  hammerheads: c("swim", 260, "#b8c4cd"),
  orcas: c("swim", 300, "#f2f5f8"),
  great_white: c("swim", 300, "#e8ecef"),
  sea_otter: c("swim", 120, "#c9a882"),
  narwhal: c("swim", 280, "#f2efe6"),
  thresher_shark: c("swim", 300, "#a9b6c9"),
  leatherback: c("swim", 160, "#9aa6b2"),
  plankton: c("drift", 160, "#d6fbff"),
  research_sub: c("swim", 180, "#2b3a47"),
  blue_whale: c("swim", 520, "#c2d4e4"),
  giant_octopus: c("swim", 200, "#f0a080"),
  oarfish: c("swim", 420, "#e5473a"),
  anglerfish: c("swim", 110, "#ffe27a"),
  coelacanth: c("swim", 170, "#f2f5f8"),
  submersible: c("swim", 150, "#f28c38"),
  golden_manta: c("swim", 200, "#fff4c2"),
  kraken: c("swim", 260, "#e07ae0"),
};

// A creature whose .svg file is missing is left out rather than breaking the page
export const CREATURE_ART: Record<string, CreatureArt> = Object.fromEntries(
  Object.entries(CREATURES).flatMap(([key, art]) =>
    CREATURE_DRAWINGS[key] ? [[key, { ...art, drawing: CREATURE_DRAWINGS[key] }]] : [],
  ),
);

// How often each tier gets a turn in the background: the rarer, the rarer
export const TIER_WEIGHT: Record<Tier, number> = { common: 10, uncommon: 6, rare: 3, epic: 1.5, legendary: 0.7 };

export const TIER_LABEL: Record<Tier, string> = {
  common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary",
};

// Text colour for each tier's label
export const TIER_COLOR: Record<Tier, string> = {
  common: "#9cc3cc", uncommon: "#3fb68b", rare: "#6fd6ea", epic: "#c08af0", legendary: "#f2c230",
};
