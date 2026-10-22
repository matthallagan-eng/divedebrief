/**
 * Smoothed ascent-rate analysis.
 *
 * Mirror of backend/app/analysis/ascent.py; both are checked against
 * shared/ascent-golden.json, so change them together.
 */

export const DEFAULT_WINDOW_S = 14;
export const DEFAULT_MIN_DURATION_S = 3;
// Matches settings.default_ascent_limit_m_per_min, used for the stored count
export const DEFAULT_LIMIT_M_PER_MIN = 9;

export interface Segment {
  start_s: number;
  end_s: number;
  peak_rate_m_per_min: number;
}

export function resample1hz(times: number[], depths: number[]): [number[], number[]] {
  if (times.length === 0) return [[], []];
  const outT: number[] = [];
  const outD: number[] = [];
  const last = times.length - 1;
  let j = 0;
  for (let t = times[0]; t <= times[last]; t += 1) {
    while (j < times.length - 2 && times[j + 1] < t) j++;
    const t0 = times[j], t1 = times[Math.min(j + 1, last)];
    const d0 = depths[j], d1 = depths[Math.min(j + 1, last)];
    const frac = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
    outT.push(t);
    outD.push(d0 + (d1 - d0) * frac);
  }
  return [outT, outD];
}

/** Smoothed ascent rate (m/min) at each point of a 1 Hz series. */
export function ascentRates(
  times: number[],
  depths: number[],
  windowS = DEFAULT_WINDOW_S,
): number[] {
  const n = times.length;
  const h = Math.max(Math.floor(windowS / 2), 1);
  return times.map((_, i) => {
    const lo = Math.max(i - h, 0);
    const hi = Math.min(i + h, n - 1);
    const span = times[hi] - times[lo];
    return span === 0 ? 0 : ((depths[lo] - depths[hi]) / span) * 60;
  });
}

export function violationSegments(
  times: number[],
  depths: number[],
  limitMPerMin: number,
  windowS = DEFAULT_WINDOW_S,
  minDurationS = DEFAULT_MIN_DURATION_S,
): Segment[] {
  const [gridT, gridD] = resample1hz(times, depths);
  const rates = ascentRates(gridT, gridD, windowS);

  const segments: Segment[] = [];
  let start: number | null = null;
  for (let i = 0; i <= rates.length; i++) {
    const rate = i < rates.length ? rates[i] : -Infinity;
    if (rate > limitMPerMin) {
      if (start === null) start = i;
    } else if (start !== null) {
      const end = i - 1;
      if (gridT[end] - gridT[start] >= minDurationS) {
        const peak = Math.max(...rates.slice(start, end + 1));
        segments.push({ start_s: gridT[start], end_s: gridT[end], peak_rate_m_per_min: peak });
      }
      start = null;
    }
  }
  return segments;
}
