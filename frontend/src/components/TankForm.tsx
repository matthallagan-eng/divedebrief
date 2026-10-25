import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Tank } from "../api/types";
import { useFormat } from "../lib/units";


// Water volume in litres; US tanks are named by the air they hold
const PRESETS: { label: string; litres: number }[] = [
  { label: "AL80", litres: 11.1 },
  { label: "AL63", litres: 9.0 },
  { label: "Steel HP100", litres: 12.9 },
  { label: "Steel HP120", litres: 15.3 },
  { label: "12 L", litres: 12 },
  { label: "15 L", litres: 15 },
];

interface Props {
  diveId: number;
  tank: Tank | null;
  onSaved: () => void;
}

const inputClass =
  "w-24 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-right text-sm text-foam outline-none transition-colors focus:border-lagoon";

export function TankForm({ diveId, tank, onSaved }: Props) {
  const sampled = tank?.source === "sampled";
  // Pressures follow the units in Settings: psi for imperial, bar for metric
  const f = useFormat();
  const unit = f.pressureUnit;
  const shown = (bar: number) => String(Math.round(f.toPressure(bar)));
  const [litres, setLitres] = useState<string>(tank?.volume_l != null ? String(tank.volume_l) : "");
  const [start, setStart] = useState<string>(tank ? shown(tank.start_bar) : "");
  const [end, setEnd] = useState<string>(tank ? shown(tank.end_bar) : "");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const body = sampled
      ? { volume_l: Number(litres) }
      : { volume_l: Number(litres), start_bar: f.fromPressure(Number(start)), end_bar: f.fromPressure(Number(end)) };
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

  // Nothing entered yet reads as "choose", not as a custom size
  const preset = litres === "" ? "" : PRESETS.find((p) => String(p.litres) === litres)?.label ?? "custom";

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-surface-border bg-surface-raised/80">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-surface-border px-5 py-3">
        <h2 className="text-sm font-medium text-foam">Tank</h2>
        <p className="text-xs text-murk">
          Pressures in {unit} · <Link to="/settings" className="text-aqua hover:text-foam">change units</Link>
        </p>
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
            <option value="" disabled>
              Choose a tank
            </option>
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
