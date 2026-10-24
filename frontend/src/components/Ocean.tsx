import type { ComponentType } from "react";
import { useSeaLife } from "../lib/display";
import { Fish, Lobster, Reef, Shark, Shipwreck, Whale } from "./SeaCreatures";

// Fixed, decorative backdrop: drifting light rays, rising bubbles, and sea
// life swimming past a reef. How much sea life is a setting (lib/display).
// Hidden from assistive tech; under prefers-reduced-motion everything holds still.

const BUBBLES = [
  { left: 4, size: 6, duration: 19, delay: 0 },
  { left: 11, size: 10, duration: 24, delay: 6 },
  { left: 18, size: 4, duration: 16, delay: 11 },
  { left: 27, size: 8, duration: 22, delay: 3 },
  { left: 35, size: 5, duration: 18, delay: 14 },
  { left: 46, size: 12, duration: 28, delay: 8 },
  { left: 53, size: 4, duration: 15, delay: 2 },
  { left: 61, size: 7, duration: 21, delay: 17 },
  { left: 69, size: 5, duration: 17, delay: 5 },
  { left: 77, size: 9, duration: 25, delay: 12 },
  { left: 84, size: 4, duration: 14, delay: 9 },
  { left: 91, size: 6, duration: 20, delay: 1 },
  { left: 97, size: 8, duration: 23, delay: 15 },
];

interface Kind {
  Shape: ComponentType;
  max: number; // how many at 100%
  minLevel: number; // none below this setting
  width: [number, number]; // px
  top: [number, number]; // % of the screen height
  duration: [number, number]; // s to cross the screen
  opacity: number;
  color: string;
}

// Far-off whales are faintest; fish are the most numerous
const KINDS: Record<string, Kind> = {
  whale: { Shape: Whale, max: 2, minLevel: 35, width: [320, 460], top: [18, 45], duration: [140, 200], opacity: 0.07, color: "text-mist" },
  shark: { Shape: Shark, max: 3, minLevel: 20, width: [150, 220], top: [25, 70], duration: [60, 95], opacity: 0.11, color: "text-mist" },
  fish: { Shape: Fish, max: 18, minLevel: 1, width: [22, 44], top: [12, 85], duration: [28, 60], opacity: 0.16, color: "text-aqua" },
};

// Deterministic, so creatures keep their places when the page re-renders
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r: () => number, [lo, hi]: [number, number]) => lo + r() * (hi - lo);

const SWIMMERS = Object.entries(KINDS).flatMap(([name, kind], k) => {
  const r = random(k + 7);
  return Array.from({ length: kind.max }, (_, i) => {
    const duration = between(r, kind.duration);
    return {
      key: `${name}-${i}`,
      kind,
      index: i,
      width: between(r, kind.width),
      top: between(r, kind.top),
      duration,
      delay: -r() * duration, // start part-way across, not all at the edge
      leftward: r() < 0.5,
      bob: 4 + r() * 4,
    };
  });
});

const LOBSTERS = [
  { left: true, duration: 210, delay: -60, width: 46 },
  { left: false, duration: 260, delay: -170, width: 38 },
  { left: true, duration: 300, delay: -20, width: 32 },
];

export default function Ocean() {
  const level = useSeaLife();
  const show = (kind: Kind, index: number) =>
    level >= kind.minLevel && index < Math.round((kind.max * level) / 100);
  const lobsters = level >= 10 ? Math.max(1, Math.round((LOBSTERS.length * level) / 100)) : 0;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="caustics absolute -inset-x-20 top-0 h-[70vh]" />
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="bubble"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}

      {SWIMMERS.filter((s) => show(s.kind, s.index)).map((s) => (
        <div
          key={s.key}
          className={`swim absolute left-0 ${s.leftward ? "swim-left" : "swim-right"}`}
          style={{ top: `${s.top}%`, animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s` }}
        >
          <div
            className={`bob ${s.kind.color}`}
            style={{
              width: s.width,
              height: s.width / 2.4,
              opacity: s.kind.opacity,
              animationDuration: `${s.bob}s`,
              transform: s.leftward ? "scaleX(-1)" : undefined,
            }}
          >
            <s.kind.Shape />
          </div>
        </div>
      ))}

      {level > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-[120px] opacity-70 sm:h-[170px]">
          <Reef />
          {level >= 20 && (
            <div className="absolute bottom-1 left-[44%] h-16 w-40 text-[#0b2a3c] sm:h-24 sm:w-60">
              <Shipwreck />
            </div>
          )}
          {LOBSTERS.slice(0, lobsters).map((l, i) => (
            <div
              key={i}
              className={`swim absolute bottom-2 left-0 ${l.left ? "swim-left" : "swim-right"}`}
              style={{ animationDuration: `${l.duration}s`, animationDelay: `${l.delay}s` }}
            >
              <div
                className="text-coral"
                style={{ width: l.width, height: l.width / 2.3, opacity: 0.35, transform: l.left ? "scaleX(-1)" : undefined }}
              >
                <Lobster />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
