import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Difficulty, Grading, ScoringSettings, SettingsResponse } from "../api/types";
import { setSeaLife, useSeaLife } from "../lib/display";
import { setUnits, useFormat } from "../lib/units";
import type { Format, Units } from "../lib/units";

// Numeric settings; the water type, difficulty and units have their own controls
type Key = Exclude<keyof ScoringSettings, "default_water_type" | "difficulty" | "units">;

interface Field {
  key: Key;
  label: string;
  unit: string;
  kind?: "depth" | "rate"; // stored metric, shown in the diver's units
  min: number;
  max: number;
  step: number;
  help?: string;
}

// Bounds mirror backend/app/scoring/settings.py
const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Ascent control",
    fields: [
      { key: "ascent_target_m_per_min", label: "Target rate", unit: "m/min", kind: "rate", min: 3, max: 18, step: 0.5,
        help: "Ascent at or under this counts as within target. The usual guidance is 9 m/min (30 ft/min)." },
      { key: "ascent_violation_m_per_min", label: "Violation rate", unit: "m/min", kind: "rate", min: 6, max: 30, step: 0.5,
        help: "Each stretch over this costs points; how many depends on the difficulty." },
      { key: "ascent_window_s", label: "Smoothing window", unit: "s", min: 4, max: 30, step: 1,
        help: "Rates are averaged over this window so sensor noise doesn't count." },
      { key: "ascent_final_zone_m", label: "Final zone", unit: "m", kind: "depth", min: 0, max: 15, step: 0.5,
        help: "Ascent shallower than this counts extra." },
      { key: "ascent_final_zone_weight", label: "Final zone weight", unit: "×", min: 1, max: 5, step: 0.5 },
    ],
  },
  {
    title: "Safety stop",
    fields: [
      { key: "stop_band_min_m", label: "Band top", unit: "m", kind: "depth", min: 1, max: 10, step: 0.5 },
      { key: "stop_band_max_m", label: "Band bottom", unit: "m", kind: "depth", min: 2, max: 12, step: 0.5 },
      { key: "stop_tolerance_m", label: "Tolerance", unit: "m", kind: "depth", min: 0, max: 2, step: 0.1,
        help: "Brief drifts this far outside the band don't end the stop." },
      { key: "stop_target_s", label: "Target time", unit: "s", min: 30, max: 600, step: 10 },
      { key: "stop_min_dive_depth_m", label: "Only for dives deeper than", unit: "m", kind: "depth", min: 0, max: 40, step: 1,
        help: "Shallower dives show N/A." },
    ],
  },
  {
    title: "Buoyancy",
    fields: [
      { key: "buoyancy_excursion_m", label: "Excursion size", unit: "m", kind: "depth", min: 0.3, max: 3, step: 0.1,
        help: "Rising or sinking more than this off your level and back counts as an excursion." },
      { key: "buoyancy_detrend_window_s", label: "Level window", unit: "s", min: 20, max: 300, step: 10,
        help: "Your level is the median depth over this window, so following the reef doesn't count." },
    ],
  },
  {
    title: "Overall score weights",
    fields: [
      { key: "weight_ascent", label: "Ascent control", unit: "×", min: 0, max: 10, step: 0.5,
        help: "0 leaves a skill out of the overall score." },
      { key: "weight_stop", label: "Safety stop", unit: "×", min: 0, max: 10, step: 0.5 },
      { key: "weight_buoyancy", label: "Buoyancy", unit: "×", min: 0, max: 10, step: 0.5 },
      { key: "weight_air", label: "Air efficiency", unit: "×", min: 0, max: 10, step: 0.5 },
    ],
  },
];

const DIFFICULTIES: { key: Difficulty; label: string; blurb: string }[] = [
  { key: "easy", label: "Easy", blurb: "For your first dives: mistakes cost little and there's slack built in." },
  { key: "normal", label: "Normal", blurb: "For divers with a few dozen dives: mistakes cost more and the slack is smaller." },
  { key: "hard", label: "Hard", blurb: "For experienced divers who want every wobble and drift to count." },
];

const inputClass =
  "w-24 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-right text-sm text-foam outline-none transition-colors focus:border-lagoon";

// A field's number in the units it's shown in, and back to the metric it's stored in
function display(f: Format, field: Field, metric: number): number {
  if (!field.kind || f.units === "metric") return metric;
  return Math.round((field.kind === "depth" ? f.toDepth(metric) : f.toRate(metric)) * 10) / 10;
}

function store(f: Format, field: Field, shown: number): number {
  if (!field.kind || f.units === "metric") return shown;
  const metric = field.kind === "depth" ? f.fromDepth(shown) : f.fromRate(shown);
  // Rounding the display can land just past a bound; the bounds are in metric
  return Math.min(field.max, Math.max(field.min, Math.round(metric * 100) / 100));
}

export default function Settings() {
  const f = useFormat();
  const [values, setValues] = useState<ScoringSettings | null>(null);
  const [saved, setSaved] = useState<ScoringSettings | null>(null);
  const [defaults, setDefaults] = useState<ScoringSettings | null>(null);
  const [grading, setGrading] = useState<SettingsResponse["grading"] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<SettingsResponse>("/settings")
      .then((s) => {
        setValues(s.values);
        setSaved(s.values);
        setDefaults(s.defaults);
        setGrading(s.grading);
        setUnits(s.values.units);
      })
      .catch((e: Error) => setStatus(e.message));
  }, []);

  if (!values || !saved || !defaults || !grading) {
    return <p className="text-sm text-murk">{status ?? "Descending…"}</p>;
  }

  async function save(next: ScoringSettings): Promise<ScoringSettings | null> {
    setBusy(true);
    setStatus(null);
    try {
      const res = await api.put<SettingsResponse>("/settings", next);
      setSaved(res.values);
      setUnits(res.values.units);
      setStatus("Saved. Your dives have been rescored.");
      return res.values;
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't save settings");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await save(values!);
    if (res) setValues(res);
  }

  // Units and difficulty are toggles: they save right away, leaving other unsaved edits alone
  async function saveNow(change: Partial<ScoringSettings>) {
    const res = await save({ ...saved!, ...change });
    if (res) setValues((v) => v && { ...v, ...change });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foam">Settings</h1>
        <p className="mt-1 text-sm text-mist">
          How your dives are graded and shown. Changing a scoring setting rescores every dive.{" "}
          <Link to="/scores" className="text-aqua hover:text-foam">How scores work</Link>
        </p>
      </div>

      <section className="rounded-xl border border-surface-border bg-surface-raised/80">
        <h2 className="border-b border-surface-border px-5 py-3 text-sm font-medium text-foam">Grading</h2>
        <div className="divide-y divide-surface-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foam">Difficulty</p>
              <p className="text-xs text-murk">
                {DIFFICULTIES.find((d) => d.key === saved.difficulty)!.blurb} Your thresholds below stay the
                same; difficulty changes how much a miss costs.
              </p>
            </div>
            <Toggle
              label="Difficulty"
              value={saved.difficulty}
              options={DIFFICULTIES.map((d) => ({ value: d.key, label: d.label }))}
              disabled={busy}
              onChange={(difficulty) => saveNow({ difficulty })}
            />
          </div>
          <GradingSummary g={grading[saved.difficulty]} f={f} />
        </div>
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-raised/80">
        <h2 className="border-b border-surface-border px-5 py-3 text-sm font-medium text-foam">Display</h2>
        <div className="divide-y divide-surface-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foam">Units</p>
              <p className="text-xs text-murk">
                Depth, rates, temperature, tank pressure and air use, everywhere including score reasons.
              </p>
            </div>
            <Toggle<Units>
              label="Units"
              value={saved.units}
              options={[
                { value: "metric", label: "Metric (m, °C, bar)" },
                { value: "imperial", label: "Imperial (ft, °F, psi)" },
              ]}
              disabled={busy}
              onChange={(units) => saveNow({ units })}
            />
          </div>
          <SeaLifeSetting />
        </div>
      </section>

      {GROUPS.map((group) => (
        <section key={group.title} className="rounded-xl border border-surface-border bg-surface-raised/80">
          <h2 className="border-b border-surface-border px-5 py-3 text-sm font-medium text-foam">{group.title}</h2>
          <div className="divide-y divide-surface-border/60">
            {group.fields.map((field) => {
              const unit = field.kind === "depth" ? f.depthUnit : field.kind === "rate" ? f.rateUnit : field.unit;
              const converted = !!field.kind && f.units === "imperial";
              return (
                <div key={field.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={field.key} className="text-sm text-foam">{field.label}</label>
                    {field.help && <p className="text-xs text-murk">{field.help}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {values[field.key] !== defaults[field.key] && (
                      <span className="text-xs text-murk">default {display(f, field, defaults[field.key])}</span>
                    )}
                    <input
                      id={field.key}
                      type="number"
                      required
                      min={display(f, field, field.min)}
                      max={display(f, field, field.max)}
                      step={converted ? "any" : field.step}
                      value={display(f, field, values[field.key])}
                      onChange={(e) => setValues({ ...values, [field.key]: store(f, field, Number(e.target.value)) })}
                      className={inputClass}
                    />
                    <span className="w-12 text-sm text-mist">{unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="rounded-xl border border-surface-border bg-surface-raised/80">
        <h2 className="border-b border-surface-border px-5 py-3 text-sm font-medium text-foam">Air efficiency</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="default_water_type" className="text-sm text-foam">Default water type</label>
            <p className="text-xs text-murk">
              Used for dives whose file doesn't say. Garmin FIT files record it from the watch's setting.
            </p>
          </div>
          <select
            id="default_water_type"
            value={values.default_water_type}
            onChange={(e) => setValues({ ...values, default_water_type: e.target.value as "salt" | "fresh" })}
            className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foam outline-none focus:border-lagoon"
          >
            <option value="salt">Salt</option>
            <option value="fresh">Fresh</option>
          </select>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-lagoon px-4 py-2 text-sm font-medium text-abyss transition-colors hover:bg-aqua disabled:opacity-50"
        >
          {busy ? "Rescoring…" : "Save"}
        </button>
        <button
          type="button"
          // Units and difficulty are saved already, so a reset leaves them as they are
          onClick={() => setValues({ ...defaults, units: saved.units, difficulty: saved.difficulty })}
          className="text-sm text-aqua hover:text-foam"
        >
          Reset thresholds to defaults
        </button>
        {status && <p className="text-sm text-mist" role="status">{status}</p>}
      </div>
    </form>
  );
}

interface ToggleProps<V extends string> {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  disabled?: boolean;
  onChange: (value: V) => void;
}

function Toggle<V extends string>({ label, value, options, disabled, onChange }: ToggleProps<V>) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-surface-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => value !== o.value && onChange(o.value)}
          className={`rounded-md px-3 py-1 text-sm transition-colors disabled:cursor-wait ${
            value === o.value ? "bg-lagoon/20 text-foam" : "text-murk hover:text-mist"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function GradingSummary({ g, f }: { g: Grading; f: Format }) {
  const items: [string, string][] = [
    ["Ascent", `−${g.ascent_violation_penalty} per stretch over the violation rate${g.ascent_over_target_penalty ? `, −${g.ascent_over_target_penalty} per stretch over the target` : ""}; up to −${g.ascent_penalty_cap}`],
    ["Safety stop", `−${g.stop_exit_penalty} per exit from the band; drift up to ${f.fine(g.stop_drift_allowance_m)} is free`],
    [
      "Buoyancy",
      `full marks for a wobble of ±${f.fine(g.buoyancy_wobble_good_m)}, none at ±${f.fine(g.buoyancy_wobble_bad_m)}; ` +
        `−${g.buoyancy_excursion_penalty} per excursion per 10 min`,
    ],
    ["Air", `matching your usual air use scores ${g.air_at_baseline}; ${g.air_points_per_pct} points per 1% better or worse`],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-1.5 px-5 py-3 text-xs sm:grid-cols-[auto_1fr]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-murk">{k}</dt>
          <dd className="text-mist">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function SeaLifeSetting() {
  const level = useSeaLife();
  const describe =
    level === 0 ? "None, just bubbles"
    : level < 20 ? "A few fish"
    : level < 35 ? "Fish, sharks and a wreck"
    : level < 70 ? "Fish, sharks and a whale"
    : "A busy reef";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <label htmlFor="sea_life" className="text-sm text-foam">Background sea life</label>
        <p className="text-xs text-murk">
          Fish, sharks, whales and lobsters swimming over a reef and shipwreck. Changes right away, on this
          device only, and doesn't affect scores.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <input
          id="sea_life"
          type="range"
          min={0}
          max={100}
          step={5}
          value={level}
          aria-valuetext={`${level}%: ${describe}`}
          onChange={(e) => setSeaLife(Number(e.target.value))}
          className="w-40"
        />
        <span className="w-44 text-sm text-mist">
          {level}% · {describe}
        </span>
      </div>
    </div>
  );
}
