import type { ComponentType } from "react";
import type { Tier } from "../../api/types";
import * as Art from "./art";

// swim: crosses the screen; floor: walks or sits on the reef; drift: rises slowly
export type Zone = "swim" | "floor" | "drift";

export interface CreatureArt {
  Art: ComponentType;
  aspect: number; // width / height of the drawing
  zone: Zone;
  width: number; // px in the background scene
  color: string;
  accent: string;
}

const c = (Art: ComponentType, aspect: number, zone: Zone, width: number, color: string, accent: string): CreatureArt => ({
  Art, aspect, zone, width, color, accent,
});

// Keyed like app/achievements.py
export const CREATURE_ART: Record<string, CreatureArt> = {
  clownfish: c(Art.Clownfish, 100 / 56, "swim", 40, "#f28c38", "#f6efe6"),
  sergeant_major: c(Art.SergeantMajor, 120 / 60, "swim", 70, "#f2d14b", "#1d2b33"),
  hermit_crab: c(Art.HermitCrab, 90 / 60, "floor", 46, "#d9643a", "#e8c9a0"),
  starfish: c(Art.Starfish, 1, "floor", 34, "#f07b5a", "#f8c2a8"),
  blue_tang: c(Art.BlueTang, 100 / 60, "swim", 46, "#2f6fd6", "#f2c230"),
  butterflyfish: c(Art.Butterflyfish, 80 / 70, "swim", 38, "#f5d547", "#1d2b33"),
  cleaner_shrimp: c(Art.CleanerShrimp, 2, "floor", 44, "#e85b4a", "#f6efe6"),
  pufferfish: c(Art.Pufferfish, 84 / 70, "swim", 44, "#d8b56a", "#6b5b3a"),
  moon_jellyfish: c(Art.MoonJellyfish, 70 / 90, "drift", 44, "#b8c7f0", "#e6c9f5"),
  bluegill: c(Art.Bluegill, 100 / 64, "swim", 44, "#7f9f5a", "#1d3550"),
  sea_urchin: c(Art.SeaUrchin, 70 / 56, "floor", 34, "#7a55b8", "#c4a8f0"),
  scuba_diver: c(Art.ScubaDiver, 130 / 60, "swim", 120, "#9fb4c7", "#f2c230"),
  seahorse: c(Art.Seahorse, 50 / 90, "drift", 26, "#f2a33a", "#f7d08a"),
  octopus: c(Art.Octopus, 90 / 70, "swim", 60, "#d4574a", "#f0a090"),
  green_turtle: c(Art.GreenTurtle, 110 / 64, "swim", 90, "#6fae7e", "#a8784a"),
  parrotfish: c(Art.Parrotfish, 110 / 56, "swim", 56, "#3fb6a8", "#e86fa8"),
  moray_eel: c(Art.MorayEel, 140 / 50, "floor", 90, "#7a9a42", "#d6e07a"),
  cuttlefish: c(Art.Cuttlefish, 110 / 50, "swim", 60, "#c9a27a", "#f2dcc0"),
  nudibranch: c(Art.Nudibranch, 90 / 40, "floor", 36, "#9b59d0", "#f5a623"),
  stingray: c(Art.Stingray, 120 / 70, "floor", 80, "#8a8f99", "#c8ccd2"),
  barracuda: c(Art.Barracuda, 150 / 36, "swim", 100, "#a8b8c4", "#4d5d6a"),
  goliath_grouper: c(Art.GoliathGrouper, 130 / 70, "swim", 110, "#8a7a5a", "#5a4a32"),
  cleaner_wrasse: c(Art.CleanerWrasse, 100 / 30, "swim", 36, "#4aa3f0", "#14202e"),
  largemouth_bass: c(Art.LargemouthBass, 120 / 50, "swim", 62, "#7f9a3e", "#2e3d1f"),
  crayfish: c(Art.Crayfish, 110 / 50, "floor", 46, "#c0533a", "#e89a7a"),
  lionfish: c(Art.Lionfish, 110 / 80, "swim", 64, "#d0603f", "#f6efe6"),
  manta_ray: c(Art.MantaRay, 2, "swim", 180, "#3a4c60", "#e6eef5"),
  eagle_ray: c(Art.EagleRay, 140 / 80, "swim", 130, "#3d5570", "#f2f5f8"),
  blacktip_shark: c(Art.BlacktipShark, 140 / 50, "swim", 150, "#8a99a6", "#141c22"),
  dolphins: c(Art.Dolphins, 170 / 70, "swim", 200, "#8fa6b8", "#d6e2ea"),
  sea_lion: c(Art.SeaLion, 130 / 56, "swim", 120, "#9a7a56", "#d8c0a0"),
  frogfish: c(Art.Frogfish, 80 / 70, "floor", 44, "#e0a33a", "#a8641e"),
  mandarinfish: c(Art.Mandarinfish, 90 / 50, "swim", 40, "#2a8fd8", "#f28c38"),
  leafy_seadragon: c(Art.LeafySeadragon, 130 / 70, "drift", 90, "#c9a94a", "#8fb35a"),
  spanish_dancer: c(Art.SpanishDancer, 110 / 60, "swim", 70, "#e0453a", "#f6d6d0"),
  napoleon_wrasse: c(Art.NapoleonWrasse, 140 / 76, "swim", 130, "#3b9f96", "#1f5f9a"),
  batfish: c(Art.Batfish, 140 / 80, "swim", 110, "#c9c9b8", "#3a3a33"),
  garden_eels: c(Art.GardenEels, 120 / 70, "floor", 90, "#d9d3b8", "#4a4a40"),
  ocean_sunfish: c(Art.OceanSunfish, 100 / 110, "swim", 110, "#b9c3cc", "#8b97a3"),
  whale_shark: c(Art.WhaleShark, 220 / 70, "swim", 340, "#3e566e", "#e6eef5"),
  hammerheads: c(Art.Hammerheads, 190 / 80, "swim", 260, "#7f8f9c", "#b8c4cd"),
  orcas: c(Art.Orcas, 200 / 80, "swim", 300, "#2a333c", "#f2f5f8"),
  great_white: c(Art.GreatWhite, 200 / 70, "swim", 300, "#7b8a96", "#e8ecef"),
  sea_otter: c(Art.SeaOtter, 140 / 64, "swim", 120, "#7a5638", "#c9a882"),
  narwhal: c(Art.Narwhal, 220 / 60, "swim", 280, "#9aa7b0", "#f2efe6"),
  thresher_shark: c(Art.ThresherShark, 220 / 70, "swim", 300, "#6f7f9a", "#a9b6c9"),
  leatherback: c(Art.Leatherback, 150 / 80, "swim", 160, "#3e464f", "#9aa6b2"),
  plankton: c(Art.Plankton, 120 / 80, "drift", 160, "#6fe0ff", "#d6fbff"),
  research_sub: c(Art.ResearchSub, 170 / 70, "swim", 180, "#f2c230", "#2b3a47"),
  blue_whale: c(Art.BlueWhale, 300 / 90, "swim", 520, "#5d7fa0", "#c2d4e4"),
  giant_octopus: c(Art.GiantOctopus, 160 / 110, "swim", 200, "#b4442f", "#f0a080"),
  oarfish: c(Art.Oarfish, 300 / 60, "swim", 420, "#c7d2db", "#e5473a"),
  anglerfish: c(Art.Anglerfish, 110 / 80, "swim", 110, "#3a4452", "#ffe27a"),
  coelacanth: c(Art.Coelacanth, 170 / 70, "swim", 170, "#3d5a80", "#f2f5f8"),
  submersible: c(Art.Submersible, 140 / 90, "swim", 150, "#e8ecef", "#f28c38"),
  golden_manta: c(Art.GoldenManta, 2, "swim", 200, "#f2c230", "#fff4c2"),
  kraken: c(Art.Kraken, 180 / 120, "swim", 260, "#7a3a7a", "#e07ae0"),
};

// How often each tier gets a turn in the background: the rarer, the rarer
export const TIER_WEIGHT: Record<Tier, number> = { common: 10, uncommon: 6, rare: 3, epic: 1.5, legendary: 0.7 };

export const TIER_LABEL: Record<Tier, string> = {
  common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary",
};

// Text colour for each tier's label
export const TIER_COLOR: Record<Tier, string> = {
  common: "#9cc3cc", uncommon: "#3fb68b", rare: "#6fd6ea", epic: "#c08af0", legendary: "#f2c230",
};
