import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProfilePoint, Region, Sample, Skill } from "../api/types";
import { formatDuration } from "../lib/format";

const LAGOON = "#1e9fbd";
const CORAL = "#de6650";
const AQUA = "#6fd6ea";
const GRID = "#16384d";
const AXIS_TEXT = "#6a8f9b";
const RULE = "#9cc3cc";
const SURFACE = "#0b2233";

// One hue per family, validated for colour-blind separation on the dark card;
// members of a family differ by dash. Every line is also named in the
// buttons and the tooltip, so colour never carries identity alone.
const YELLOW = "#c98500";
const MAGENTA = "#d55181";
const VIOLET = "#9085e9";
const TEAL = "#199e70";
const ORANGE = "#d95926";
const DASHED = "6 4";
const DOTTED = "2 3";

// Keep the SVG light on long dives; highlight bands use exact region times
const MAX_POINTS = 2000;
// NDL counts up to hours in the shallows; like Subsurface, cap the scale
const NDL_CAP_MIN = 99;
// Air: 1.293 g/L at 1 ATA; ppO2 and ppN2 assume air when the computer didn't record them
const AIR_DENSITY_G_L = 1.293;
const METRES_PER_ATM = { salt: 10.0, fresh: 10.3 };
const SAC_WINDOW_S = 60;
const STORAGE_KEY = "divedebrief.profileGraphs";
// Overlaid on their own axes: depth keeps the top of the chart and each line
// gets a lane of its own below it, so none of them cross
const DEPTH_SHARE = 0.38;
const LANES_FROM = 0.58; // lanes fill the chart below this height, as a share from the bottom
const LANE_GAP = 0.18; // of each lane's height
const LANE_PX = 90;

type SeriesKey =
  | "rate" | "temp" | "hr" | "pressure" | "sac" | "ndl" | "tts"
  | "po2" | "pn2" | "density" | "n2" | "cns";
type DepthKey = "mean" | "ceiling";

interface Point {
  t: number;
  depth: number;
  region: Region | null;
  hlDepth: number | null;
  hlRate: number | null;
  mean: number;
  ceiling: number | null;
  rate: number;
  temp: number | null;
  hr: number | null;
  pressure: number | null;
  sac: number | null;
  ndl: number | null;
  tts: number | null;
  po2: number;
  pn2: number;
  density: number;
  n2: number | null;
  cns: number | null;
}

interface SeriesDef {
  key: SeriesKey;
  label: string;
  group: string;
  color: string;
  dash?: string;
  unit: string;
  digits: number;
  hint: string;
}

// Grouped the way Subsurface's profile toolbar groups them
const SERIES: SeriesDef[] = [
  { key: "rate", label: "Ascent rate", group: "Motion", color: YELLOW, unit: "m/min", digits: 1, hint: "Above zero is rising toward the surface" },
  { key: "temp", label: "Temperature", group: "Body & water", color: MAGENTA, unit: "°C", digits: 0, hint: "Water temperature from the dive computer" },
  { key: "hr", label: "Heart rate", group: "Body & water", color: MAGENTA, dash: DASHED, unit: "bpm", digits: 0, hint: "From the watch's wrist sensor" },
  { key: "pressure", label: "Tank pressure", group: "Air", color: TEAL, unit: "bar", digits: 0, hint: "From a tank transmitter" },
  { key: "sac", label: "SAC rate", group: "Air", color: TEAL, dash: DASHED, unit: "L/min", digits: 1, hint: "Surface air consumption over the last minute, from tank pressure and size" },
  { key: "ndl", label: "NDL", group: "Decompression", color: ORANGE, unit: "min", digits: 0, hint: `No-decompression limit, capped at ${NDL_CAP_MIN} min` },
  { key: "tts", label: "Time to surface", group: "Decompression", color: ORANGE, dash: DASHED, unit: "min", digits: 0, hint: "Including any required stops" },
  { key: "n2", label: "N₂ tissue load", group: "Decompression", color: ORANGE, dash: DOTTED, unit: "%", digits: 0, hint: "Leading tissue's nitrogen, as a share of its limit" },
  { key: "cns", label: "CNS", group: "Gas", color: VIOLET, dash: DOTTED, unit: "%", digits: 0, hint: "Oxygen toxicity clock" },
  { key: "po2", label: "ppO₂", group: "Gas", color: VIOLET, unit: "bar", digits: 2, hint: "Oxygen partial pressure; calculated for air if the computer didn't record it" },
  { key: "pn2", label: "ppN₂", group: "Gas", color: VIOLET, dash: DASHED, unit: "bar", digits: 2, hint: "Nitrogen partial pressure, calculated" },
  { key: "density", label: "Gas density", group: "Gas", color: VIOLET, dash: "1 2 6 2", unit: "g/L", digits: 1, hint: "Density of the air you breathed, calculated; above 5.2 g/L breathing gets hard" },
];

const DEPTH_OVERLAYS: { key: DepthKey; label: string; color: string; dash?: string; hint: string }[] = [
  { key: "mean", label: "Mean depth", color: LAGOON, dash: DASHED, hint: "Running average depth so far" },
  { key: "ceiling", label: "Ceiling", color: ORANGE, hint: "Decompression ceiling from the dive computer" },
];

interface Prefs {
  series: SeriesKey[];
  depth: DepthKey[];
  overlay: boolean;
  lanes: boolean; // overlaid lines each get their own axis and lane
}

const DEFAULT_PREFS: Prefs = { series: ["rate"], depth: [], overlay: false, lanes: true };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Private windows can block storage; the choice just won't be remembered
  }
}

interface Props {
  profile: ProfilePoint[];
  samples: Sample[];
  tankVolumeL: number | null;
  waterType: "salt" | "fresh";
  skill: Skill | null;
  regions: Region[];
  target: number;
  violation: number;
}

export function DiveCharts({ profile, samples, tankVolumeL, waterType, skill, regions, target, violation }: Props) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const update = (change: Partial<Prefs>) => {
    const next = { ...prefs, ...change };
    setPrefs(next);
    savePrefs(next);
  };

  const data = useMemo(
    () => buildPoints(profile, samples, regions, tankVolumeL, METRES_PER_ATM[waterType]),
    [profile, samples, regions, tankVolumeL, waterType],
  );

  // Only offer what this dive recorded, or what can be calculated from it
  const available = useMemo(() => {
    const has = (k: keyof Point) => data.some((p) => p[k] !== null);
    return {
      series: SERIES.filter((s) => has(s.key)),
      depth: DEPTH_OVERLAYS.filter((d) => has(d.key)),
    };
  }, [data]);
  const shown = available.series.filter((s) => prefs.series.includes(s.key));
  const depthShown = available.depth.filter((d) => prefs.depth.includes(d.key));

  const toggle = <K extends string>(list: K[], key: K) =>
    list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

  const depthTicks = niceTicks(0, Math.max(...data.map((p) => p.depth), 1));
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
      yAxisId="main"
      fill={r.severity === "info" ? AQUA : CORAL}
      fillOpacity={r.severity === "info" ? 0.1 : 0.12}
      stroke="none"
      ifOverflow="hidden"
    />
  ));
  const tooltipSeries = shown;
  const tooltip = (
    <Tooltip
      content={<ProfileTooltip series={tooltipSeries} depth={depthShown} />}
      cursor={{ stroke: RULE, strokeWidth: 1 }}
    />
  );
  const margin = { top: 10, right: 8, bottom: 0, left: -8 };
  const lanes = prefs.overlay && prefs.lanes && shown.length > 0;
  const depthMax = depthTicks[depthTicks.length - 1];
  const activeDot = (color: string) => ({ r: 4, fill: color, stroke: SURFACE, strokeWidth: 2 });

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-surface-border bg-surface-raised/80 p-5">
        <GraphPicker
          series={available.series}
          depth={available.depth}
          prefs={prefs}
          onToggleSeries={(k) => update({ series: toggle(prefs.series, k) })}
          onToggleDepth={(k) => update({ depth: toggle(prefs.depth, k) })}
          onOverlay={(overlay) => update({ overlay })}
          onLanes={(lanes) => update({ lanes })}
        />

        <div className="mb-3 mt-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-foam">Depth profile</h2>
          <Legend skill={skill} target={target} />
        </div>
        <ResponsiveContainer
          width="100%"
          height={lanes ? 260 + LANE_PX * shown.length : prefs.overlay && shown.length ? 360 : 300}
        >
          <ComposedChart data={data} syncId="dive" syncMethod="value" margin={lanes ? { ...margin, right: 56 } : margin}>
            <CartesianGrid stroke={GRID} vertical={false} yAxisId="main" />
            {xAxis}
            <YAxis
              yAxisId="main"
              reversed
              domain={[0, lanes ? depthMax / DEPTH_SHARE : depthMax]}
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
            {depthShown.some((d) => d.key === "ceiling") && (
              <Area
                yAxisId="main"
                dataKey="ceiling"
                type="stepAfter"
                stroke={ORANGE}
                strokeWidth={1.5}
                fill={ORANGE}
                fillOpacity={0.25}
                isAnimationActive={false}
                activeDot={false}
              />
            )}
            <Area
              yAxisId="main"
              dataKey="depth"
              type="monotone"
              stroke={LAGOON}
              strokeWidth={2}
              fill={LAGOON}
              fillOpacity={0.1}
              isAnimationActive={false}
              activeDot={activeDot(LAGOON)}
            />
            <Line
              yAxisId="main"
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
            {depthShown.some((d) => d.key === "mean") && (
              <Line
                yAxisId="main"
                dataKey="mean"
                type="monotone"
                stroke={LAGOON}
                strokeDasharray={DASHED}
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
            {/* Overlaid like Subsurface, either each on its own unmarked scale (read
                off the tooltip) or each in its own lane with its own axis */}
            {prefs.overlay &&
              shown.flatMap((s, i) => {
                // A lane is short, so its axis gets only a few labels
                const ticks = seriesTicks(data, s, target, violation, lanes ? 2 : 5);
                const isRate = s.key === "rate";
                const axisMarks = lanes
                  ? [
                      ...ticks.map((v) => (
                        <ReferenceLine
                          key={`${s.key}-tick-${v}`}
                          yAxisId={s.key}
                          y={v}
                          stroke={GRID}
                          label={{ value: v, position: "right", fill: AXIS_TEXT, fontSize: 11 }}
                        />
                      )),
                      <ReferenceLine
                        key={`${s.key}-name`}
                        yAxisId={s.key}
                        y={ticks[ticks.length - 1]}
                        stroke="none"
                        label={{ value: `${s.label} (${s.unit})`, position: "insideTopLeft", fill: RULE, fontSize: 11 }}
                      />,
                      ...(isRate
                        ? [
                            <ReferenceLine key="rate-target" yAxisId={s.key} y={target} stroke={RULE} strokeWidth={1} />,
                            <ReferenceLine key="rate-limit" yAxisId={s.key} y={violation} stroke={CORAL} strokeWidth={1} />,
                          ]
                        : []),
                    ]
                  : [];
                return [
                  <YAxis
                    key={`axis-${s.key}`}
                    yAxisId={s.key}
                    hide
                    orientation="right"
                    domain={lanes ? laneDomain(ticks, i, shown.length) : paddedDomain(data, s.key)}
                    allowDataOverflow
                  />,
                  ...axisMarks,
                  <Line
                    key={s.key}
                    yAxisId={s.key}
                    dataKey={s.key}
                    type="monotone"
                    stroke={s.color}
                    strokeDasharray={s.dash}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                    activeDot={activeDot(s.color)}
                  />,
                  ...(isRate
                    ? [
                        <Line
                          key="hlRate"
                          yAxisId={s.key}
                          dataKey="hlRate"
                          type="monotone"
                          stroke={CORAL}
                          strokeWidth={1.5}
                          dot={false}
                          activeDot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                        />,
                      ]
                    : []),
                ];
              })}
          </ComposedChart>
        </ResponsiveContainer>
        {prefs.overlay && !lanes && shown.length > 0 && (
          <p className="mt-2 text-xs text-murk">
            Overlapping lines are each scaled to fit the chart; hover for their values, or choose
            own axes to read them off a scale.
          </p>
        )}
      </section>

      {!prefs.overlay &&
        shown.map((s) => (
          <SeriesChart
            key={s.key}
            def={s}
            data={data}
            xAxis={xAxis}
            bands={bands}
            tooltip={tooltip}
            margin={margin}
            target={target}
            violation={violation}
          />
        ))}
    </div>
  );
}

interface SeriesChartProps {
  def: SeriesDef;
  data: Point[];
  xAxis: ReactNode;
  bands: ReactNode;
  tooltip: ReactNode;
  margin: { top: number; right: number; bottom: number; left: number };
  target: number;
  violation: number;
}

function SeriesChart({ def, data, xAxis, bands, tooltip, margin, target, violation }: SeriesChartProps) {
  const isRate = def.key === "rate";
  const ticks = seriesTicks(data, def, target, violation);
  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised/80 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-medium text-foam">
          {def.label} <span className="font-normal text-murk">{def.unit}</span>
        </h2>
        <p className="text-xs text-murk">
          {isRate
            ? `Above zero is rising toward the surface · light rule is your ${target} m/min target, coral rule the ${violation} m/min violation limit`
            : def.hint}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={isRate ? 180 : 150}>
        <ComposedChart data={data} syncId="dive" syncMethod="value" margin={margin}>
          <CartesianGrid stroke={GRID} vertical={false} yAxisId="main" />
          {xAxis}
          <YAxis
            yAxisId="main"
            domain={[ticks[0], ticks[ticks.length - 1]]}
            ticks={ticks}
            interval={0}
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          {bands}
          {isRate && (
            <>
              <ReferenceLine yAxisId="main" y={0} stroke={GRID} />
              <ReferenceLine yAxisId="main" y={target} stroke={RULE} strokeWidth={1} />
              <ReferenceLine yAxisId="main" y={violation} stroke={CORAL} strokeWidth={1} />
            </>
          )}
          {tooltip}
          <Line
            yAxisId="main"
            dataKey={def.key}
            type="monotone"
            stroke={def.color}
            strokeDasharray={def.dash}
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
            activeDot={{ r: 4, fill: def.color, stroke: SURFACE, strokeWidth: 2 }}
          />
          {isRate && (
            <Line
              yAxisId="main"
              dataKey="hlRate"
              type="monotone"
              stroke={CORAL}
              strokeWidth={2}
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}

interface PickerProps {
  series: SeriesDef[];
  depth: typeof DEPTH_OVERLAYS;
  prefs: Prefs;
  onToggleSeries: (k: SeriesKey) => void;
  onToggleDepth: (k: DepthKey) => void;
  onOverlay: (overlay: boolean) => void;
  onLanes: (lanes: boolean) => void;
}

function GraphPicker({ series, depth, prefs, onToggleSeries, onToggleDepth, onOverlay, onLanes }: PickerProps) {
  const groups = [...new Set(series.map((s) => s.group))];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foam">Graphs</h2>
        <div className="flex flex-wrap gap-2">
          {prefs.overlay && (
            <Segmented
              label="Overlaid scales"
              value={prefs.lanes}
              options={[
                { value: true, label: "Own axes" },
                { value: false, label: "Overlapping" },
              ]}
              onChange={onLanes}
            />
          )}
          <Segmented
            label="Graph layout"
            value={prefs.overlay}
            options={[
              { value: false, label: "Stacked" },
              { value: true, label: "Overlaid" },
            ]}
            onChange={onOverlay}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {depth.length > 0 && (
          <PickerGroup name="Depth">
            {depth.map((d) => (
              <ToggleButton
                key={d.key}
                label={d.label}
                hint={d.hint}
                color={d.color}
                dash={d.dash}
                pressed={prefs.depth.includes(d.key)}
                onClick={() => onToggleDepth(d.key)}
              />
            ))}
          </PickerGroup>
        )}
        {groups.map((g) => (
          <PickerGroup key={g} name={g}>
            {series
              .filter((s) => s.group === g)
              .map((s) => (
                <ToggleButton
                  key={s.key}
                  label={s.label}
                  hint={s.hint}
                  color={s.color}
                  dash={s.dash}
                  pressed={prefs.series.includes(s.key)}
                  onClick={() => onToggleSeries(s.key)}
                />
              ))}
          </PickerGroup>
        ))}
      </div>
    </div>
  );
}

interface SegmentedProps<V> {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (value: V) => void;
}

function Segmented<V>({ label, value, options, onChange }: SegmentedProps<V>) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-surface-border p-0.5">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-xs transition-colors ${
            value === o.value ? "bg-lagoon/20 text-foam" : "text-murk hover:text-mist"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PickerGroup({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={name}>
      <p className="mb-1.5 text-[11px] uppercase tracking-wide text-murk">{name}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  hint: string;
  color: string;
  dash?: string;
  pressed: boolean;
  onClick: () => void;
}

function ToggleButton({ label, hint, color, dash, pressed, onClick }: ToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={hint}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        pressed
          ? "border-lagoon/60 bg-lagoon/15 text-foam"
          : "border-surface-border text-murk hover:border-surface-border hover:text-mist"
      }`}
    >
      <LineSwatch color={color} dash={dash} muted={!pressed} />
      {label}
    </button>
  );
}

function LineSwatch({ color, dash, muted }: { color: string; dash?: string; muted?: boolean }) {
  return (
    <svg width="16" height="6" aria-hidden="true" className={muted ? "opacity-40" : undefined}>
      <line x1="1" y1="3" x2="15" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}

/** Merge the 1 Hz profile with the raw samples, and calculate what the computer didn't record. */
function buildPoints(
  profile: ProfilePoint[],
  samples: Sample[],
  regions: Region[],
  tankVolumeL: number | null,
  metresPerAtm: number,
): Point[] {
  const sorted = [...samples].sort((a, b) => a.t_s - b.t_s);
  let j = -1;
  let temp: number | null = null;
  let pressure: number | null = null;
  let depthSum = 0;
  // Tank pressure and temperature are sparse, so they hold their last reading
  const held: { t: number; pressure: number | null }[] = [];
  const all: Point[] = profile.map((p, i) => {
    while (j + 1 < sorted.length && sorted[j + 1].t_s <= p.t_s) {
      j++;
      if (sorted[j].temp_k !== null) temp = sorted[j].temp_k! - 273.15;
      if (sorted[j].tank_pressure_bar !== null) pressure = sorted[j].tank_pressure_bar;
    }
    const s = j >= 0 ? sorted[j] : null;
    const ata = p.depth_m / metresPerAtm + 1;
    const po2 = s?.po2_bar ?? 0.21 * ata;
    depthSum += p.depth_m;
    held.push({ t: p.t_s, pressure });
    const region = regions.find((r) => p.t_s >= r.start_s && p.t_s <= r.end_s) ?? null;
    // Ascent regions recolor the line itself; the stop is shown as a band only
    const line = region && region.severity !== "info";
    return {
      t: p.t_s,
      depth: p.depth_m,
      region,
      hlDepth: line ? p.depth_m : null,
      hlRate: line ? p.rate_m_per_min : null,
      mean: depthSum / (i + 1),
      ceiling: s?.ceiling_m ?? null,
      rate: p.rate_m_per_min,
      temp,
      hr: s?.heart_rate ?? null,
      pressure,
      sac: null,
      ndl: s?.ndl_s == null ? null : Math.min(s.ndl_s / 60, NDL_CAP_MIN),
      tts: s?.tts_s == null ? null : s.tts_s / 60,
      po2,
      pn2: Math.max(ata - po2, 0),
      density: AIR_DENSITY_G_L * ata,
      n2: s?.n2_load_pct ?? null,
      cns: s?.cns_pct ?? null,
    };
  });

  // SAC: pressure used over the last minute, scaled to the surface
  if (tankVolumeL) {
    let k = 0;
    for (let i = 0; i < all.length; i++) {
      while (held[k].t < all[i].t - SAC_WINDOW_S) k++;
      const from = held[k].pressure;
      const to = held[i].pressure;
      const minutes = (all[i].t - held[k].t) / 60;
      if (from === null || to === null || minutes < SAC_WINDOW_S / 120) continue;
      const ata = all[i].depth / metresPerAtm + 1;
      all[i].sac = Math.max(((from - to) * tankVolumeL) / minutes / ata, 0);
    }
  }

  const step = Math.max(1, Math.ceil(all.length / MAX_POINTS));
  return step === 1 ? all : all.filter((_, i) => i % step === 0);
}

/** Axis ticks for a series; ascent rate always shows the target and violation limit. */
function seriesTicks(data: Point[], def: SeriesDef, target: number, violation: number, steps = 5): number[] {
  const values = data.map((p) => p[def.key]).filter((v): v is number => v !== null);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return def.key === "rate"
    ? niceTicks(Math.min(lo, -target), Math.max(hi, violation + 2), steps)
    : niceTicks(lo, hi > lo ? hi : lo + 1, steps);
}

/** Stretch an axis so its ticks fill lane `index` of `count`, top lane first, under the depth. */
function laneDomain(ticks: number[], index: number, count: number): [number, number] {
  const height = LANES_FROM / count;
  const top = LANES_FROM - index * height - (height * LANE_GAP) / 2;
  const bottom = top - height * (1 - LANE_GAP);
  const lo = ticks[0];
  const span = ticks[ticks.length - 1] - lo;
  const perUnit = span / (top - bottom);
  return [lo - bottom * perUnit, lo + span + (1 - top) * perUnit];
}

function paddedDomain(data: Point[], key: SeriesKey): [number, number] {
  const values = data.map((p) => p[key]).filter((v): v is number => v !== null);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.1, 0.5);
  return [lo - pad, hi + pad];
}

/** Round ticks covering [min, max] with ~4-6 steps of 1, 2, 5 or 10 × 10^n. */
function niceTicks(min: number, max: number, steps = 5): number[] {
  const rough = (max - min) / steps;
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
      {skill === "buoyancy" && (
        <>
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-4 rounded-sm" style={{ background: AQUA, opacity: 0.35 }} />
            Bottom phase
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: CORAL }} />
            Excursion
          </li>
        </>
      )}
    </ul>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: Point }[];
  series: SeriesDef[];
  depth: typeof DEPTH_OVERLAYS;
}

function ProfileTooltip({ active, payload, series, depth }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const rows: { label: string; value: string; color: string; dash?: string }[] = [
    { label: "Depth", value: `${p.depth.toFixed(1)} m`, color: LAGOON },
    ...depth.map((d) => ({
      label: d.label,
      value: d.key === "ceiling" ? (p.ceiling ? `${p.ceiling.toFixed(1)} m` : "No stop") : `${p.mean.toFixed(1)} m`,
      color: d.color,
      dash: d.dash,
    })),
    ...series.map((s) => {
      const v = p[s.key];
      const capped = s.key === "ndl" && v === NDL_CAP_MIN;
      return {
        label: s.label,
        value: v === null ? "—" : `${capped ? ">" : ""}${v.toFixed(s.digits)} ${s.unit}`,
        color: s.color,
        dash: s.dash,
      };
    }),
  ];
  return (
    <div className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs shadow-lg shadow-black/40">
      <p className="font-mono text-murk">{formatDuration(p.t)}</p>
      <table className="mt-1 tabular-nums">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="pr-1.5">
                <LineSwatch color={r.color} dash={r.dash} />
              </td>
              <td className="pr-3 text-mist">{r.label}</td>
              <td className="text-right text-foam">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {p.region && <p className="mt-1 text-foam">{p.region.label}</p>}
    </div>
  );
}
