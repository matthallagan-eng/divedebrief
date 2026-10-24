import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";
import type { Tank } from "../api/types";

const PSI_PER_BAR = 14.5038;
const UNIT_KEY = "divedebrief.pressureUnit";

// Water volume in litres; US tanks are named by the air they hold
const PRESETS: { label: string; litres: number }[] = [
  { label: "AL80", litres: 11.1 },
  { label: "AL63", litres: 9.0 },
  { label: "Steel HP100", litres: 12.9 },
  { label: "Steel HP120", litres: 15.3 },
  { label: "12 L", litres: 12 },
  { label: "15 L", litres: 15 },
];

type Unit = "psi" | "bar";

function loadUnit(): Unit {
  try {
    return localStorage.getItem(UNIT_KEY) === "bar" ? "bar" : "psi";
  } catch {
    return "psi";
  }
}

function saveUnit(unit: Unit) {
  try {
    localStorage.setItem(UNIT_KEY, unit);
  } catch {
    // storage unavailable: the choice lasts until the page reloads
  }
}

const toUnit = (bar: number, unit: Unit) => (unit === "psi" ? Math.round(bar * PSI_PER_BAR) : Math.round(bar));
const toBar = (value: number, unit: Unit) => (unit === "psi" ? value / PSI_PER_BAR : value);

interface Props {
  diveId: number;
  tank: Tank | null;
  onSaved: () => void;
}

const inputClass =
  "w-24 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-right text-sm text-foam outline-none transition-colors focus:border-lagoon";

export function TankForm({ diveId, tank, onSaved }: Props) {
  const sampled = tank?.source === "sampled";
  const [unit, setUnit] = useState<Unit>(loadUnit);
  const [litres, setLitres] = useState<string>(tank?.volume_l != null ? String(tank.volume_l) : "");
  const [start, setStart] = useState<string>(tank ? String(toUnit(tank.start_bar, unit)) : "");
  const [end, setEnd] = useState<string>(tank ? String(toUnit(tank.end_bar, unit)) : "");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchUnit(next: Unit) {
    if (next === unit) return;
    const convert = (v: string) => (v === "" ? "" : String(toUnit(toBar(Number(v), unit), next)));
    setStart(convert(start));
    setEnd(convert(end));
    setUnit(next);
    saveUnit(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const body = sampled
      ? { volume_l: Number(litres) }
      : { volume_l: Number(litres), start_bar: toBar(Number(start), unit), end_bar: toBar(Number(end), unit) };
    try {
      await api.put(`/dives/${diveId}/tank`, body);
      setStatus("Saved.");
      onSaved();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't save the tank");
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    try {
      await api.del(`/dives/${diveId}/tank`);
      setLitres("");
      setStart("");
      setEnd("");
      setStatus(null);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  const preset = PRESETS.find((p) => String(p.litres) === litres)?.label ?? "custom";

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-surface-border bg-surface-raised/80">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-surface-border px-5 py-3">
        <h2 className="text-sm font-medium text-foam">Tank</h2>
        <div className="flex gap-1 text-xs" role="group" aria-label="Pressure unit">
          {(["psi", "bar"] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unit === u}
              onClick={() => switchUnit(u)}
              className={`rounded-md px-2 py-1 ${unit === u ? "bg-lagoon/15 text-foam" : "text-murk hover:text-mist"}`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 px-5 py-4">
        <label className="space-y-1 text-xs text-murk">
          <span className="block">Tank</span>
          <select
            value={preset}
            onChange={(e) => {
              const p = PRESETS.find((x) => x.label === e.target.value);
              if (p) setLitres(String(p.litres));
            }}
            className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foam outline-none focus:border-lagoon"
          >
            {PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label} ({p.litres} L)
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-murk">
          <span className="block">Size (L of water)</span>
          <input
            type="number" required min={1} max={30} step={0.1}
            value={litres} onChange={(e) => setLitres(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs text-murk">
          <span className="block">Start ({unit})</span>
          <input
            type="number" required min={1} step={1} disabled={sampled}
            value={start} onChange={(e) => setStart(e.target.value)}
            className={`${inputClass} disabled:opacity-60`}
          />
        </label>
        <label className="space-y-1 text-xs text-murk">
          <span className="block">End ({unit})</span>
          <input
            type="number" required min={0} step={1} disabled={sampled}
            value={end} onChange={(e) => setEnd(e.target.value)}
            className={`${inputClass} disabled:opacity-60`}
          />
        </label>
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-lagoon px-4 py-1.5 text-sm font-medium text-abyss transition-colors hover:bg-aqua disabled:opacity-50"
          >
            Save
          </button>
          {tank && !sampled && (
            <button type="button" onClick={handleClear} disabled={busy} className="text-sm text-aqua hover:text-foam">
              Clear
            </button>
          )}
        </div>
      </div>
      <p className="px-5 pb-4 text-xs text-murk">
        {sampled
          ? "Pressures come from your dive computer's transmitter. Add the tank size to work out air use."
          : "Your watch has no tank pressure for this dive, so enter it here. Used for air efficiency."}
        {status && <span className="ml-2 text-mist" role="status">{status}</span>}
      </p>
    </form>
  );
}
