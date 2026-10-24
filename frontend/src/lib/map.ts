import type { MapDive } from "../api/types";

type LngLat = [number, number];

/** Where the dive went in and came out; either may be missing. */
export function diveFixes(d: MapDive) {
  const entry = d.entry_latitude !== null && d.entry_longitude !== null ? ([d.entry_longitude, d.entry_latitude] as LngLat) : null;
  const exit = d.exit_latitude !== null && d.exit_longitude !== null ? ([d.exit_longitude, d.exit_latitude] as LngLat) : null;
  const position = d.latitude !== null && d.longitude !== null ? ([d.longitude, d.latitude] as LngLat) : null;
  return { entry, exit, position };
}
