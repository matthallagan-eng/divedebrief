import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProfilePoint, Region, Skill } from "../api/types";
import { formatDuration } from "../lib/format";

const LAGOON = "#1e9fbd";
const CORAL = "#de6650";
const AQUA = "#6fd6ea";
const GRID = "#16384d";
const AXIS_TEXT = "#6a8f9b";
const RULE = "#9cc3cc";

// Keep the SVG light on long dives; highlight bands use exact region times
const MAX_POINTS = 2000;

interface Point {
  t: number;
  depth: number;
  rate: number;
  region: Region | null;
  hlDepth: number | null;
  hlRate: number | null;
}

interface Props {
  profile: ProfilePoint[];
  skill: Skill | null;
  regions: Region[];
  target: number;
  violation: number;
}

export function DiveCharts({ profile, skill, regions, target, violation }: Props) {
  const data = useMemo(() => {
    const step = Math.max(1, Math.ceil(profile.length / MAX_POINTS));
    const points: Point[] = [];
    for (let i = 0; i < profile.length; i += step) {
      const p = profile[i];
      const region = regions.find((r) => p.t_s >= r.start_s && p.t_s <= r.end_s) ?? null;
      // Ascent regions recolor the line itself; the stop is shown as a band only
      const line = region && region.severity !== "info";
      points.push({
        t: p.t_s,
        depth: p.depth_m,
        rate: p.rate_m_per_min,
        region,
        hlDepth: line ? p.depth_m : null,
        hlRate: line ? p.rate_m_per_min : null,
      });
    }
    return points;
  }, [profile, regions]);

  const depthTicks = niceTicks(0, Math.max(...data.map((p) => p.depth), 1));
  const rateTicks = niceTicks(
    Math.min(...data.map((p) => p.rate), -target),
    Math.max(...data.map((p) => p.rate), violation + 2),
  );
  const xAxis = (
    <XAxis
      dataKey="t"
      type="number"
      domain={["dataMin", "dataMax"]}
      tickFormatter={(s: number) => `${Math.round(s / 60)}`}
      tick={{ fill: AXIS_TEXT, fontSize: 12 }}
      tickLine={false}
      axisLine={{ stroke: GRID }}
      unit=" min"
    />
  );
  const bands = regions.map((r) => (
    <ReferenceArea
      key={`${r.start_s}-${r.end_s}`}
      x1={r.start_s}
      x2={r.end_s}
      fill={r.severity === "info" ? AQUA : CORAL}
      fillOpacity={r.severity === "info" ? 0.1 : 0.12}
      stroke="none"
      ifOverflow="hidden"
    />
  ));
  const tooltip = <Tooltip content={<ProfileTooltip />} cursor={{ stroke: RULE, strokeWidth: 1 }} />;
  const margin = { top: 10, right: 8, bottom: 0, left: -8 };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-surface-border bg-surface-raised/80 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-foam">Depth profile</h2>
          <Legend skill={skill} target={target} />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} syncId="dive" syncMethod="value" margin={margin}>
            <CartesianGrid stroke={GRID} vertical={false} />
            {xAxis}
            <YAxis
              reversed
              domain={[0, depthTicks[depthTicks.length - 1]]}
              ticks={depthTicks}
              interval={0}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              unit=" m"
              width={56}
            />
            {bands}
            {tooltip}
            <Area
              dataKey="depth"
              type="monotone"
              stroke={LAGOON}
              strokeWidth={2}
              fill={LAGOON}
              fillOpacity={0.1}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: LAGOON, stroke: "#0b2233", strokeWidth: 2 }}
            />
            <Line
              dataKey="hlDepth"
              type="monotone"
              stroke={CORAL}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-raised/80 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-medium text-foam">Ascent rate</h2>
          <p className="text-xs text-murk">
            m/min · above zero is rising toward the surface · light rule is your {target} m/min
            target, coral rule the {violation} m/min violation limit
          </p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} syncId="dive" syncMethod="value" margin={margin}>
            <CartesianGrid stroke={GRID} vertical={false} />
            {xAxis}
            <YAxis
              domain={[rateTicks[0], rateTicks[rateTicks.length - 1]]}
              ticks={rateTicks}
              interval={0}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            {bands}
            <ReferenceLine y={0} stroke={GRID} />
            <ReferenceLine y={target} stroke={RULE} strokeWidth={1} />
            <ReferenceLine y={violation} stroke={CORAL} strokeWidth={1} />
            {tooltip}
            <Line
              dataKey="rate"
              type="monotone"
              stroke={LAGOON}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: LAGOON, stroke: "#0b2233", strokeWidth: 2 }}
            />
            <Line
              dataKey="hlRate"
              type="monotone"
              stroke={CORAL}
              strokeWidth={2}
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

/** Round ticks covering [min, max] with ~4-6 steps of 1, 2, 5 or 10 × 10^n. */
function niceTicks(min: number, max: number): number[] {
  const rough = (max - min) / 5;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v < max + step; v += step) {
    ticks.push(Number(v.toFixed(6)));
    if (v >= max) break;
  }
  return ticks;
}

function Legend({ skill, target }: { skill: Skill | null; target: number }) {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-mist">
      <li className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded-full" style={{ background: LAGOON }} />
        Depth
      </li>
      {skill === "ascent" && (
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: CORAL }} />
          Ascent over {target} m/min
        </li>
      )}
      {skill === "stop" && (
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm" style={{ background: AQUA, opacity: 0.35 }} />
          Safety stop
        </li>
      )}
    </ul>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: Point }[];
}

function ProfileTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs shadow-lg shadow-black/40">
      <p className="font-mono text-murk">{formatDuration(p.t)}</p>
      <p className="mt-1 text-foam">
        <span className="text-mist">Depth</span> {p.depth.toFixed(1)} m
      </p>
      <p className="text-foam">
        <span className="text-mist">Ascent</span> {p.rate.toFixed(1)} m/min
      </p>
      {p.region && <p className="mt-1 text-foam">{p.region.label}</p>}
    </div>
  );
}
