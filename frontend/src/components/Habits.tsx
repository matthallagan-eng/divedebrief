import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { Headline, Skill, TrendPoint, Trends } from "../api/types";
import { SKILL_NAMES, formatScore } from "../lib/skills";
import { formatDate } from "../lib/format";
import { useFormat } from "../lib/units";

// Validated as a pair against surface-raised (dataviz validate_palette, dark)
const LAGOON = "#1e9fbd";
const CORAL = "#de6650";
const GRID = "#16384d";
const AXIS_TEXT = "#6a8f9b";
const RULE = "#9cc3cc";
const SURFACE = "#0b2233";

type Measure = Skill | "overall";
const MEASURES: Measure[] = ["overall", "ascent", "stop", "buoyancy", "air"];
const LABELS: Record<Measure, string> = { overall: "Overall", ...SKILL_NAMES };

interface Row {
  n: number; // dive number within the filter, oldest = 1
  point: TrendPoint;
  overall: number | null;
  ascent: number | null;
  stop: number | null;
  buoyancy: number | null;
  air: number | null;
  median: number | null;
  fastest: number | null;
}

interface Props {
  trends: Trends;
  siteNames: Map<number, string>;
  target: number;
  violation: number;
}

export function Habits({ trends, siteNames, target, violation }: Props) {
  // Ascent rates are stored in m/min
  const f = useFormat();
  const rate = (v: number | null) => (v === null ? null : f.toRate(v));
  const rows: Row[] = trends.points.map((p, i) => ({
    n: i + 1,
    point: p,
    overall: p.overall_score,
    ...p.scores,
    median: rate(p.median_ascent_m_per_min),
    fastest: rate(p.max_ascent_m_per_min),
  }));
  const headlines = new Map(trends.headlines.map((h) => [h.skill, h]));
  const site = (p: TrendPoint) => (p.site_id === null ? "Unknown site" : siteNames.get(p.site_id) ?? "Unnamed site");

  return (
    <section aria-label="Habits over time" className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-foam">Habits over time</h2>
        <p className="text-xs text-murk">
          Big numbers average your last {trends.window} scored dives, compared with the {trends.window} before.
          Charts run from your oldest dive on the left to the newest on the right.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {MEASURES.map((m) => (
          <SkillTrend key={m} measure={m} headline={headlines.get(m)!} window={trends.window} rows={rows} site={site} />
        ))}
      </div>

      <AscentTrend
        rows={rows}
        site={site}
        target={f.rateLabel(target)}
        violation={f.rateLabel(violation)}
        unit={f.rateUnit}
      />
    </section>
  );
}

function Change({ h, window }: { h: Headline; window: number }) {
  if (h.recent === null) return <p className="text-xs text-murk">No scored dives yet</p>;
  if (h.previous === null) {
    return (
      <p className="text-xs text-murk">
        Last {h.recent_dives}. Comparison starts at {window + 1} scored dives
      </p>
    );
  }
  const delta = h.recent - h.previous;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const tone = delta > 0 ? "text-seagrass" : delta < 0 ? "text-coral" : "text-murk";
  return (
    <p className="flex items-center gap-1 text-xs text-mist">
      <Icon size={14} className={tone} aria-hidden />
      {delta === 0 ? "Same as" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} vs`} the {h.previous_dives} before
    </p>
  );
}

function SkillTrend({
  measure,
  headline,
  window,
  rows,
  site,
}: {
  measure: Measure;
  headline: Headline;
  window: number;
  rows: Row[];
  site: (p: TrendPoint) => string;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised/80 p-4">
      <p className="text-xs font-medium text-murk">{LABELS[measure]}</p>
      <p className="mt-1 text-2xl font-semibold text-foam">{formatScore(headline.recent)}</p>
      <Change h={headline} window={window} />
      <div className="mt-3 h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="n" type="number" domain={["dataMin", "dataMax"]} hide />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} hide />
            <Tooltip
              cursor={{ stroke: RULE, strokeWidth: 1 }}
              content={<PointTooltip render={(r) => `${LABELS[measure]} ${formatScore(r[measure])}`} site={site} />}
            />
            <Line
              dataKey={measure}
              type="monotone"
              stroke={LAGOON}
              strokeWidth={2}
              connectNulls
              dot={{ r: 3, fill: LAGOON, stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: LAGOON, stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AscentTrend({
  rows,
  site,
  target,
  violation,
  unit,
}: {
  rows: Row[];
  site: (p: TrendPoint) => string;
  target: number;
  violation: number;
  unit: string;
}) {
  const top = Math.max(violation + 3, ...rows.map((r) => r.fastest ?? 0));
  const step = top > 40 ? 10 : 5; // ft/min runs about three times higher than m/min
  const ceiling = Math.ceil(top / step) * step;
  const ticks = Array.from({ length: ceiling / step + 1 }, (_, i) => i * step);
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised/80 p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foam">Ascent rate per dive</h3>
          <p className="text-xs text-murk">
            {unit} while rising · solid rule is your {target} {unit} target, dashed rule the {violation} {unit} limit
          </p>
        </div>
        <ul className="flex gap-4 text-xs text-mist">
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: LAGOON }} />
            Median
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: CORAL }} />
            Fastest
          </li>
        </ul>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="n"
            type="number"
            domain={["dataMin", "dataMax"]}
            allowDecimals={false}
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            tickFormatter={(n: number) => `#${n}`}
          />
          <YAxis
            domain={[0, ceiling]}
            ticks={ticks}
            interval={0}
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <ReferenceLine y={target} stroke={RULE} strokeWidth={1} />
          <ReferenceLine y={violation} stroke={RULE} strokeWidth={1} strokeDasharray="4 4" />
          <Tooltip
            cursor={{ stroke: RULE, strokeWidth: 1 }}
            content={
              <PointTooltip
                site={site}
                render={(r) =>
                  r.median === null ? "No ascent found" : `Median ${r.median.toFixed(1)} · fastest ${r.fastest!.toFixed(1)} ${unit}`
                }
              />
            }
          />
          {(["median", "fastest"] as const).map((key) => {
            const color = key === "median" ? LAGOON : CORAL;
            return (
              <Line
                key={key}
                dataKey={key}
                type="monotone"
                stroke={color}
                strokeWidth={2}
                connectNulls
                dot={{ r: 4, fill: color, stroke: SURFACE, strokeWidth: 2 }}
                activeDot={{ r: 5, fill: color, stroke: SURFACE, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: Row }[];
  render: (r: Row) => string;
  site: (p: TrendPoint) => string;
}

function PointTooltip({ active, payload, render, site }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs shadow-lg shadow-black/40">
      <p className="text-murk">
        #{r.n} · {formatDate(r.point.started_at)} · {site(r.point)}
      </p>
      <p className="mt-1 text-foam">{render(r)}</p>
    </div>
  );
}
