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
import { TriangleAlert } from "lucide-react";
import type { Sample } from "../api/types";
import { ascentRates, resample1hz, type Segment } from "../lib/ascent";
import { formatDuration } from "../lib/format";

const LAGOON = "#1e9fbd";
const CORAL = "#de6650";
const GRID = "#16384d";
const AXIS_TEXT = "#6a8f9b";
const LIMIT_RULE = "#9cc3cc";

// Keep the SVG light on long dives; violation bands still come from the full grid
const MAX_POINTS = 2000;

interface Point {
  t: number; // seconds
  depth: number;
  rate: number;
  fast: boolean;
  fastDepth: number | null;
  fastRate: number | null;
}

interface Props {
  samples: Sample[];
  segments: Segment[];
  limit: number;
}

export function DiveCharts({ samples, segments, limit }: Props) {
  const data = useMemo(() => {
    const [t, d] = resample1hz(samples.map((s) => s.t_s), samples.map((s) => s.depth_m));
    const rates = ascentRates(t, d);
    const step = Math.max(1, Math.ceil(t.length / MAX_POINTS));
    const points: Point[] = [];
    for (let i = 0; i < t.length; i += step) {
      const fast = segments.some((s) => t[i] >= s.start_s && t[i] <= s.end_s);
      points.push({
        t: t[i],
        depth: d[i],
        rate: rates[i],
        fast,
        fastDepth: fast ? d[i] : null,
        fastRate: fast ? rates[i] : null,
      });
    }
    return points;
  }, [samples, segments]);

  const depthTicks = niceTicks(0, Math.max(...data.map((p) => p.depth), 1));
  const rateTicks = niceTicks(
    Math.min(...data.map((p) => p.rate), -limit),
    Math.max(...data.map((p) => p.rate), limit + 3),
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
  const bands = segments.map((s) => (
    <ReferenceArea
      key={s.start_s}
      x1={s.start_s}
      x2={s.end_s}
      fill={CORAL}
      fillOpacity={0.12}
      stroke="none"
      ifOverflow="hidden"
    />
  ));

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-surface-border bg-surface-raised/80 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-foam">Depth profile</h2>
          <Legend limit={limit} />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} syncId="dive" syncMethod="value" margin={{ top: 10, right: 8, bottom: 0, left: -8 }}>
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
            <Tooltip content={<ProfileTooltip limit={limit} />} cursor={{ stroke: LIMIT_RULE, strokeWidth: 1 }} />
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
              dataKey="fastDepth"
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
            m/min, smoothed over 14 s · above zero is rising toward the surface · light rule marks the {limit} m/min limit
          </p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} syncId="dive" syncMethod="value" margin={{ top: 10, right: 8, bottom: 0, left: -8 }}>
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
            <ReferenceLine y={limit} stroke={LIMIT_RULE} strokeWidth={1} />
            <Tooltip content={<ProfileTooltip limit={limit} />} cursor={{ stroke: LIMIT_RULE, strokeWidth: 1 }} />
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
              dataKey="fastRate"
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

function Legend({ limit }: { limit: number }) {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-mist">
      <li className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded-full" style={{ background: LAGOON }} />
        Depth
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded-full" style={{ background: CORAL }} />
        Ascent faster than {limit} m/min
      </li>
    </ul>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: Point }[];
  limit: number;
}

function ProfileTooltip({ active, payload, limit }: TooltipProps) {
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
      {p.fast && (
        <p className="mt-1 flex items-center gap-1 text-foam">
          <TriangleAlert size={12} className="text-coral" />
          Over {limit} m/min
        </p>
      )}
    </div>
  );
}
