import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resample1hz, violationSegments } from "./ascent";

interface GoldenCase {
  name: string;
  times: number[];
  depths: number[];
  limit_m_per_min: number;
  window_s?: number;
  min_duration_s?: number;
  expected: { start_s: number; end_s: number; peak_rate_m_per_min: number }[];
}

const golden = JSON.parse(
  readFileSync(new URL("../../../shared/ascent-golden.json", import.meta.url), "utf8"),
) as { cases: GoldenCase[] };

describe("violationSegments golden cases", () => {
  it.each(golden.cases.map((c) => [c.name, c] as const))("%s", (_, c) => {
    const segments = violationSegments(c.times, c.depths, c.limit_m_per_min, c.window_s, c.min_duration_s);
    expect(segments).toHaveLength(c.expected.length);
    segments.forEach((seg, i) => {
      const exp = c.expected[i];
      expect(Math.abs(seg.start_s - exp.start_s)).toBeLessThan(1e-6);
      expect(Math.abs(seg.end_s - exp.end_s)).toBeLessThan(1e-6);
      expect(Math.abs(seg.peak_rate_m_per_min - exp.peak_rate_m_per_min)).toBeLessThan(1e-6);
    });
  });
});

describe("resample1hz", () => {
  it("interpolates irregular samples", () => {
    const [t, d] = resample1hz([0, 2, 5], [0, 4, 10]);
    expect(t).toEqual([0, 1, 2, 3, 4, 5]);
    d.forEach((v, i) => expect(v).toBeCloseTo([0, 2, 4, 6, 8, 10][i]));
  });
});
