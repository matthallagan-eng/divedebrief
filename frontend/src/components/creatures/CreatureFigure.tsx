import type { CSSProperties } from "react";
import { CREATURE_ART } from "./registry";

interface Props {
  creature: string; // key from app/achievements.py
  height: number; // px; the width follows the drawing
  maxWidth?: number;
  locked?: boolean; // a plain silhouette, not yet earned
  className?: string;
}

export function CreatureFigure({ creature, height, maxWidth, locked, className = "" }: Props) {
  const art = CREATURE_ART[creature];
  if (!art) return null;
  let width = height * art.aspect;
  if (maxWidth && width > maxWidth) width = maxWidth;
  const style = {
    width,
    height: width / art.aspect,
    // One flat colour, details and eyes included, so nothing gives it away
    color: locked ? "#1d4560" : art.color,
    "--accent": locked ? "#1d4560" : art.accent,
    "--eye": locked ? "#1d4560" : undefined,
  } as CSSProperties;
  return (
    <div className={className} style={style}>
      <art.Art />
    </div>
  );
}
