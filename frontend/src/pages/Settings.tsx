import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { ScoringSettings, SettingsResponse } from "../api/types";

type Key = keyof ScoringSettings;

interface Field {
  key: Key;
  label: string;
  unit: string;
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
      { key: "ascent_target_m_per_min", label: "Target rate", unit: "m/min", min: 3, max: 18, step: 0.5,
        help: "Ascent at or under this counts as within target. 9 m/min is 30 ft/min." },
      { key: "ascent_violation_m_per_min", label: "Violation rate", unit: "m/min", min: 6, max: 30, step: 0.5,
        help: "Each stretch over this costs 10 points. 18 m/min is 60 ft/min." },
      { key: "ascent_window_s", label: "Smoothing window", unit: "s", min: 4, max: 30, step: 1,
        help: "Rates are averaged over this window so sensor noise doesn't count." },
      { key: "ascent_final_zone_m", label: "Final zone", unit: "m", min: 0, max: 15, step: 0.5,
        help: "Ascent shallower than this counts extra." },
      { key: "ascent_final_zone_weight", label: "Final zone weight", unit: "×", min: 1, max: 5, step: 0.5 },
    ],
  },
  {
    title: "Safety stop",
    fields: [
      { key: "stop_band_min_m", label: "Band top", unit: "m", min: 1, max: 10, step: 0.5 },
      { key: "stop_band_max_m", label: "Band bottom", unit: "m", min: 2, max: 12, step: 0.5 },
      { key: "stop_tolerance_m", label: "Tolerance", unit: "m", min: 0, max: 2, step: 0.1,
        help: "Brief drifts this far outside the band don't end the stop." },
      { key: "stop_target_s", label: "Target time", unit: "s", min: 30, max: 600, step: 10 },
      { key: "stop_min_dive_depth_m", label: "Only for dives deeper than", unit: "m", min: 0, max: 40, step: 1,
        help: "Shallower dives show N/A." },
    ],
  },
  {
    title: "Buoyancy",
    fields: [
      { key: "buoyancy_excursion_m", label: "Excursion size", unit: "m", min: 0.3, max: 3, step: 0.1,
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
    ],
  },
];

const inputClass =
  "w-24 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-right text-sm text-foam outline-none transition-colors focus:border-lagoon";

export default function Settings() {
  const [values, setValues] = useState<ScoringSettings | null>(null);
  const [defaults, setDefaults] = useState<ScoringSettings | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<SettingsResponse>("/settings")
      .then((s) => {
        setValues(s.values);
        setDefaults(s.defaults);
      })
      .catch((e: Error) => setStatus(e.message));
  }, []);

  if (!values || !defaults) return <p className="text-sm text-murk">{status ?? "Descending…"}</p>;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await api.put<SettingsResponse>("/settings", values);
      setValues(res.values);
      setStatus("Saved. Your dives have been rescored.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't save settings");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foam">Settings</h1>
        <p className="mt-1 text-sm text-mist">
          Thresholds used to score your dives. Changing them rescores every dive.{" "}
          <Link to="/scores" className="text-aqua hover:text-foam">How scores work</Link>
        </p>
      </div>

      {GROUPS.map((group) => (
        <section key={group.title} className="rounded-xl border border-surface-border bg-surface-raised/80">
          <h2 className="border-b border-surface-border px-5 py-3 text-sm font-medium text-foam">{group.title}</h2>
          <div className="divide-y divide-surface-border/60">
            {group.fields.map((f) => (
              <div key={f.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <label htmlFor={f.key} className="text-sm text-foam">{f.label}</label>
                  {f.help && <p className="text-xs text-murk">{f.help}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {values[f.key] !== defaults[f.key] && (
                    <span className="text-xs text-murk">default {defaults[f.key]}</span>
                  )}
                  <input
                    id={f.key}
                    type="number"
                    required
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={values[f.key]}
                    onChange={(e) => setValues({ ...values, [f.key]: Number(e.target.value) })}
                    className={inputClass}
                  />
                  <span className="w-12 text-sm text-mist">{f.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

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
          onClick={() => setValues(defaults)}
          className="text-sm text-aqua hover:text-foam"
        >
          Reset to defaults
        </button>
        {status && <p className="text-sm text-mist" role="status">{status}</p>}
      </div>
    </form>
  );
}
