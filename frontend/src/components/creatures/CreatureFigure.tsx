import { useId } from "react";
import type { CSSProperties } from "react";
import { DrawingView } from "./DrawingView";
import { CREATURE_ART } from "./registry";

interface Props {
  creature: string; // key from app/achievements.py
  height: number; // px; the width follows the drawing
  maxWidth?: number;
  locked?: boolean; // a plain silhouette, not yet earned
  className?: string;
}

export function CreatureFigure({ creature, height, maxWidth, locked, className = "" }: Props) {
  const flat = useId();
  const art = CREATURE_ART[creature];
  if (!art) return null;
  const { aspect } = art.drawing;
  let width = height * aspect;
  if (maxWidth && width > maxWidth) width = maxWidth;
  const style = { width, height: width / aspect, filter: locked ? `url(#${CSS.escape(flat)})` : undefined } as CSSProperties;
  return (
    <div className={className} style={style}>
      {locked && (
        // Repaints the drawing in one flat colour, details and eyes included, so nothing gives it away
        <svg width="0" height="0" className="absolute">
          <filter id={flat} x="-50%" y="-50%" width="200%" height="200%">
            <feFlood floodColor="#1d4560" />
            <feComposite in2="SourceAlpha" operator="in" />
          </filter>
        </svg>
      )}
      <DrawingView drawing={art.drawing} />
    </div>
  );
}
