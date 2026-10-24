import { useSyncExternalStore } from "react";

// Display preferences for this browser only; they don't affect any scores
const SEA_LIFE_KEY = "divedebrief.seaLife";
const DEFAULT_SEA_LIFE = 50; // 0 = none, 100 = busiest

const listeners = new Set<() => void>();

function read(): number {
  try {
    const raw = localStorage.getItem(SEA_LIFE_KEY);
    const n = raw === null ? DEFAULT_SEA_LIFE : Number(raw);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : DEFAULT_SEA_LIFE;
  } catch {
    return DEFAULT_SEA_LIFE;
  }
}

let current = read();

export function setSeaLife(value: number) {
  current = Math.min(100, Math.max(0, Math.round(value)));
  try {
    localStorage.setItem(SEA_LIFE_KEY, String(current));
  } catch {
    // storage unavailable: the choice lasts until the page reloads
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** How much sea life swims in the background, 0-100. */
export function useSeaLife(): number {
  return useSyncExternalStore(subscribe, () => current);
}
