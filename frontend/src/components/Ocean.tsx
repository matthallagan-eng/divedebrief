import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ComponentType, ReactNode } from "react";
import type { Achievement } from "../api/types";
import { useUnlockedCreatures } from "../context/AchievementsContext";
import { useSeaLife } from "../lib/display";
import { DrawingView } from "./creatures/DrawingView";
import { CREATURE_ART, TIER_WEIGHT, type Zone } from "./creatures/registry";
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

// Paths are worked out each frame from one shared clock rather than by CSS
// keyframes, so a creature's position is always a smooth function of time:
// re-renders, refetches and swapping in the next creature can't make it jump.
// The clock only runs while the tab is visible, so nothing skips ahead either.
type Mover = (clock: number, vw: number, vh: number) => void;
const movers = new Set<Mover>();
let clock = 0; // s
let last = 0;
let frame = 0;

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function tick(now: number) {
  // Capped, so a backgrounded tab resumes where it left off
  clock += Math.min(now - last, 100) / 1000;
  last = now;
  movers.forEach((m) => m(clock, window.innerWidth, window.innerHeight));
  frame = requestAnimationFrame(tick);
}

function useMover(move: Mover) {
  const latest = useRef(move);
  useLayoutEffect(() => {
    latest.current = move;
  });
  useLayoutEffect(() => {
    const m: Mover = (...args) => latest.current(...args);
    // Placed before the first paint, so nothing flashes at the corner
    m(clock, window.innerWidth, window.innerHeight);
    movers.add(m);
    if (movers.size === 1 && !still()) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
    return () => {
      movers.delete(m);
      if (movers.size === 0) cancelAnimationFrame(frame);
    };
  }, []);
}

// Room past the edge for a glow, so creatures enter and leave fully off screen
const MARGIN = 40;

// p runs 0..1 across the screen, from wholly off one side to wholly off the other
const across = (el: HTMLElement | null, p: number, width: number, leftward: boolean, vw: number) => {
  if (!el) return;
  const from = -width - MARGIN;
  const to = vw + MARGIN;
  const x = leftward ? to + (from - to) * p : from + (to - from) * p;
  el.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
};

const upward = (el: HTMLElement | null, p: number, height: number, vh: number) => {
  if (!el) return;
  const from = vh + MARGIN;
  const to = -height - MARGIN;
  el.style.transform = `translate3d(0, ${(from + (to - from) * p).toFixed(1)}px, 0)`;
};

/** Crosses the screen forever: duration s per crossing, starting a fraction phase of the way. */
function Looping({ width, leftward, duration, phase, className, style, children }: {
  width: number;
  leftward: boolean;
  duration: number;
  phase: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useMover((t, vw) => across(ref.current, (t / duration + phase) % 1, width, leftward, vw));
  return (
    <div ref={ref} className={`absolute left-0 will-change-transform ${className ?? ""}`} style={style}>
      {children}
    </div>
  );
}

interface Kind {
  Shape: ComponentType;
  max: number; // how many at 100%
  minLevel: number; // none below this setting
  width: [number, number]; // px
  top: [number, number]; // % of the screen height
  duration: [number, number]; // s to cross the screen
  opacity: number;
}

// Far-off whales are faintest; fish are the most numerous
const KINDS: Record<string, Kind> = {
  whale: { Shape: Whale, max: 2, minLevel: 35, width: [320, 460], top: [18, 45], duration: [140, 200], opacity: 0.07 },
  shark: { Shape: Shark, max: 3, minLevel: 20, width: [150, 220], top: [25, 70], duration: [60, 95], opacity: 0.11 },
  fish: { Shape: Fish, max: 18, minLevel: 1, width: [22, 44], top: [12, 85], duration: [28, 60], opacity: 0.16 },
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
  return Array.from({ length: kind.max }, (_, i) => ({
    key: `${name}-${i}`,
    kind,
    index: i,
    width: between(r, kind.width),
    top: between(r, kind.top),
    duration: between(r, kind.duration),
    phase: r(), // start part-way across, not all at the edge
    leftward: r() < 0.5,
    bob: 4 + r() * 4,
  }));
});

const LOBSTERS = [
  { left: true, duration: 210, phase: 0.29, width: 46 },
  { left: false, duration: 260, phase: 0.65, width: 38 },
  { left: true, duration: 300, phase: 0.07, width: 32 },
];

// Unlocked creatures (achievements) take turns in a few slots, so the scene
// never gets crowded: each time one leaves, the slot picks another, rarer
// tiers less often. At most four at once, fewer at a lower sea-life setting.
const SLOTS: { zone: Zone; minLevel: number }[] = [
  { zone: "swim", minLevel: 1 },
  { zone: "floor", minLevel: 10 },
  { zone: "drift", minLevel: 30 },
  { zone: "swim", minLevel: 45 },
];

function pick(pool: Achievement[], r: () => number): Achievement {
  const total = pool.reduce((sum, a) => sum + TIER_WEIGHT[a.tier], 0);
  let x = r() * total;
  for (const a of pool) {
    x -= TIER_WEIGHT[a.tier];
    if (x <= 0) return a;
  }
  return pool[pool.length - 1];
}

interface Trip {
  n: number; // trips this slot has made
  key: string; // the creature
  width: number;
  top: number; // % of the screen; drifters use it as the left edge
  leftward: boolean;
  duration: number; // s
  start: number; // on the shared clock; only the first trip starts part-way along
}

function plan(pool: Achievement[], slot: number, zone: Zone, n: number): Trip {
  const r = random(slot * 997 + n * 31 + 3);
  const a = pick(pool, r);
  const art = CREATURE_ART[a.key];
  const width = art.width * (0.85 + r() * 0.3);
  // Big creatures cruise slowly
  const duration = zone === "floor" ? 220 + r() * 80 : zone === "drift" ? 70 + r() * 40 : 45 + width / 5 + r() * 20;
  return {
    n,
    key: a.key,
    width,
    top: zone === "drift" ? 8 + r() * 80 : 15 + r() * 55,
    leftward: r() < 0.5,
    duration,
    start: n === 0 ? clock - r() * duration : clock,
  };
}

/** One creature's single trip across (or up) the screen; it waits off screen at the end. */
function Traveller({ trip, zone, rare, onDone }: { trip: Trip; zone: Zone; rare: boolean; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const ended = useRef(false);
  const art = CREATURE_ART[trip.key];
  const height = trip.width / art.drawing.aspect;
  useMover((t, vw, vh) => {
    const p = Math.min(1, Math.max(0, (t - trip.start) / trip.duration));
    if (zone === "drift") upward(ref.current, p, height, vh);
    else across(ref.current, p, trip.width, trip.leftward, vw);
    if (p >= 1 && !ended.current) {
      ended.current = true;
      onDone();
    }
  });

  const figure = {
    width: trip.width,
    height,
    "--accent": art.glow,
    opacity: rare ? 0.32 : 0.24,
    transform: trip.leftward && zone !== "drift" ? "scaleX(-1)" : undefined,
    animationDuration: zone === "drift" ? "6s" : "7s",
  } as CSSProperties;
  const place =
    zone === "drift"
      ? { className: "top-0", style: { left: `${trip.top}%` } }
      : zone === "floor"
        ? { className: "left-0 bottom-3", style: undefined }
        : { className: "left-0", style: { top: `${trip.top}%` } };

  return (
    <div ref={ref} className={`absolute will-change-transform ${place.className}`} style={place.style}>
      <div className={`${zone === "floor" ? "" : "bob"} ${rare ? "glow" : ""}`} style={figure}>
        <DrawingView drawing={art.drawing} />
      </div>
    </div>
  );
}

function UnlockedSlot({ slot, zone, unlocked }: { slot: number; zone: Zone; unlocked: Achievement[] }) {
  const pool = unlocked.filter((a) => CREATURE_ART[a.key]?.zone === zone);
  // The creature is chosen once per trip and kept until it has left the
  // screen, even if the pool changes, so nothing pops in or out mid-path
  const [trip, setTrip] = useState<Trip | null>(null);
  if (trip === null && pool.length > 0) {
    setTrip(plan(pool, slot, zone, 0));
    return null;
  }
  if (trip === null) return null;

  const tier = unlocked.find((a) => a.key === trip.key)?.tier;
  return (
    <Traveller
      key={trip.n}
      trip={trip}
      zone={zone}
      rare={tier === "epic" || tier === "legendary"}
      onDone={() => setTrip(pool.length > 0 ? plan(pool, slot, zone, trip.n + 1) : null)}
    />
  );
}

export default function Ocean() {
  const level = useSeaLife();
  const unlocked = useUnlockedCreatures();
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
        <Looping
          key={s.key}
          width={s.width}
          leftward={s.leftward}
          duration={s.duration}
          phase={s.phase}
          style={{ top: `${s.top}%` }}
        >
          <div
            className="bob"
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
        </Looping>
      ))}

      {SLOTS.map((s, i) =>
        level >= s.minLevel ? <UnlockedSlot key={i} slot={i} zone={s.zone} unlocked={unlocked} /> : null,
      )}

      {level > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-[120px] opacity-70 sm:h-[170px]">
          <Reef />
          {level >= 20 && (
            <div className="absolute bottom-1 left-[44%] h-16 w-40 sm:h-24 sm:w-60">
              <Shipwreck />
            </div>
          )}
          {LOBSTERS.slice(0, lobsters).map((l, i) => (
            <Looping key={i} width={l.width} leftward={l.left} duration={l.duration} phase={l.phase} className="bottom-2">
              <div
                style={{ width: l.width, height: l.width / 2.3, opacity: 0.35, transform: l.left ? "scaleX(-1)" : undefined }}
              >
                <Lobster />
              </div>
            </Looping>
          ))}
        </div>
      )}
    </div>
  );
}
