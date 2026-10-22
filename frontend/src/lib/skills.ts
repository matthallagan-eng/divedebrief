import type { Skill } from "../api/types";

export const SKILL_NAMES: Record<Skill, string> = {
  ascent: "Ascent control",
  stop: "Safety stop",
  buoyancy: "Buoyancy",
};

export function formatScore(score: number | null): string {
  return score === null ? "N/A" : String(score);
}
