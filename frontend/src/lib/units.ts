import { useMemo, useSyncExternalStore } from "react";

// Everything is stored in metric; this converts it for display. The choice is
// part of the diver's settings on the server (score reasons use it too) and
// cached here so pages render in the right units before /settings loads.
export type Units = "metric" | "imperial";

const UNITS_KEY = "divedebrief.units";
const FT_PER_M = 3.28084;
const PSI_PER_BAR = 14.5038;
const L_PER_CU_FT = 28.3168;
const KELVIN = 273.15;
const KG_PER_LB = 0.453592;

const listeners = new Set<() => void>();

function read(): Units {
  try {
    return localStorage.getItem(UNITS_KEY) === "imperial" ? "imperial" : "metric";
  } catch {
    return "metric";
  }
}

let current = read();

export function setUnits(units: Units) {
  if (units === current) return;
  current = units;
  try {
    localStorage.setItem(UNITS_KEY, units);
  } catch {
    // storage unavailable: the server copy still applies on the next load
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useUnits(): Units {
  return useSyncExternalStore(subscribe, () => current);
}

export interface Format {
  units: Units;
  depthUnit: string;
  rateUnit: string;
  tempUnit: string;
  pressureUnit: string;
  sacUnit: string;
  weightUnit: string;
  // Numbers in display units, for chart axes and form fields
  toDepth: (m: number) => number;
  fromDepth: (value: number) => number;
  toRate: (mPerMin: number) => number;
  fromRate: (value: number) => number;
  toTemp: (k: number) => number;
  toPressure: (bar: number) => number;
  fromPressure: (value: number) => number;
  toSac: (lPerMin: number) => number;
  toWeight: (kg: number) => number;
  fromWeight: (value: number) => number;
  rateLabel: (mPerMin: number) => number; // a threshold as shown in text: whole ft/min, 0.1 m/min
  // Labelled strings
  depth: (m: number) => string;
  fine: (m: number) => string; // small lengths and thresholds, e.g. 0.25 m
  temp: (k: number | null) => string;
  tempRange: (lowK: number, highK: number) => string;
  distance: (m: number) => string;
}

export function makeFormat(units: Units): Format {
  const imperial = units === "imperial";
  const toDepth = (m: number) => (imperial ? m * FT_PER_M : m);
  const toTemp = (k: number) => (imperial ? ((k - KELVIN) * 9) / 5 + 32 : k - KELVIN);
  const tempUnit = imperial ? "°F" : "°C";
  return {
    units,
    depthUnit: imperial ? "ft" : "m",
    rateUnit: imperial ? "ft/min" : "m/min",
    tempUnit,
    pressureUnit: imperial ? "psi" : "bar",
    sacUnit: imperial ? "cu ft/min" : "L/min",
    weightUnit: imperial ? "lb" : "kg",
    toDepth,
    fromDepth: (v) => (imperial ? v / FT_PER_M : v),
    toRate: toDepth,
    fromRate: (v) => (imperial ? v / FT_PER_M : v),
    toTemp,
    toPressure: (bar) => (imperial ? bar * PSI_PER_BAR : bar),
    fromPressure: (v) => (imperial ? v / PSI_PER_BAR : v),
    toSac: (l) => (imperial ? l / L_PER_CU_FT : l),
    toWeight: (kg) => (imperial ? kg / KG_PER_LB : kg),
    fromWeight: (v) => (imperial ? v * KG_PER_LB : v),
    rateLabel: (r) => +toDepth(r).toFixed(imperial ? 0 : 1),
    // A foot is a third of a metre, so feet need no decimal
    depth: (m) => (imperial ? `${Math.round(m * FT_PER_M)} ft` : `${m.toFixed(1)} m`),
    fine: (m) => (imperial ? `${+(m * FT_PER_M).toFixed(1)} ft` : `${+m.toFixed(2)} m`),
    temp: (k) => (k === null ? "—" : `${toTemp(k).toFixed(0)} ${tempUnit}`),
    tempRange: (lowK, highK) => {
      const [lo, hi] = [lowK, highK].map((k) => toTemp(k).toFixed(0));
      return lo === hi ? `${lo} ${tempUnit}` : `${lo}–${hi} ${tempUnit}`;
    },
    distance: (m) => {
      if (imperial) {
        const ft = m * FT_PER_M;
        return ft < 1000 ? `${Math.round(ft)} ft` : `${(m / 1609.34).toFixed(1)} mi`;
      }
      return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
    },
  };
}

/** Formatters in the diver's units; re-renders when they change them. */
export function useFormat(): Format {
  const units = useUnits();
  return useMemo(() => makeFormat(units), [units]);
}
