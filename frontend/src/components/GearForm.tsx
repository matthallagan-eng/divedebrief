import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Gear, GearHistoryRow, GearInput, GearPreset, Suit } from "../api/types";
import { formatDate } from "../lib/format";
import { formatScore } from "../lib/skills";
import { useFormat } from "../lib/units";

const SUITS: { value: Suit; label: string }[] = [
  { value: "none", label: "None / swimwear" },
  { value: "shorty", label: "Shorty" },
  { value: "3mm", label: "3 mm wetsuit" },
  { value: "5mm", label: "5 mm wetsuit" },
  { value: "7mm", label: "7 mm wetsuit" },
  { value: "semidry", label: "Semidry" },
  { value: "drysuit", label: "Drysuit" },
];
const SUIT_LABELS = Object.fromEntries(SUITS.map((s) => [s.value, s.label]));
const TANKS = { aluminum: "Aluminum", steel: "Steel" };

interface Props {
  diveId: number;
  gear: Gear | null;
  onSaved: () => void;
}

const fieldClass =
  "rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foam outline-none transition-colors focus:border-lagoon";

/** Weights, suit and tank material, with the diver's weighting history alongside buoyancy. */
export function GearForm({ diveId, gear, onSaved }: Props) {
  const f = useFormat();
  const shown = (kg: number | null) => (kg === null ? "" : String(+f.toWeight(kg).toFixed(1)));
  const [weight, setWeight] = useState(shown(gear?.weight_kg ?? null));
  const [suit, setSuit] = useState<Suit | "">(gear?.suit ?? "");
  const [tank, setTank] = useState<GearInput["tank_material"] | "">(gear?.tank_material ?? "");
  const [history, setHistory] = useState<GearHistoryRow[] | null>(null);
  const [presets, setPresets] = useState<GearPreset[]>([]);
  const [kitName, setKitName] = useState("");
  const [kitStatus, setKitStatus] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<GearHistoryRow[]>("/dives/gear-history").then(setHistory).catch(() => setHistory([]));
  }, [gear?.updated_at]);

  useEffect(() => {
    api.get<GearPreset[]>("/gear-presets").then(setPresets).catch(() => setPresets([]));
  }, []);

  // Most divers wear the same kit dive after dive, so offer the last one
  const last = history?.find((h) => h.dive_id !== diveId) ?? null;

  function fillFromLast() {
    if (!last) return;
    setWeight(shown(last.weight_kg));
    setSuit(last.suit ?? "");
    setTank(last.tank_material ?? "");
  }

  function formValues(): GearInput {
    return {
      weight_kg: weight === "" ? null : Math.round(f.fromWeight(Number(weight)) * 100) / 100,
      suit: suit || null,
      tank_material: tank || null,
    };
  }

  function applyKit(kit: GearPreset) {
    setWeight(shown(kit.weight_kg));
    setSuit(kit.suit ?? "");
    setTank(kit.tank_material ?? "");
    setKitName(kit.name);
    setStatus(`${kit.name} filled in. Save to keep it on this dive.`);
  }

  // Saving under an existing kit's name updates that kit
  const sameName = presets.find((p) => p.name.toLowerCase() === kitName.trim().toLowerCase()) ?? null;

  async function handleSaveKit() {
    setKitStatus(null);
    const body = { ...formValues(), name: sameName?.name ?? kitName.trim() };
    try {
      if (sameName) {
        const kit = await api.put<GearPreset>(`/gear-presets/${sameName.id}`, body);
        setPresets((ps) => ps.map((p) => (p.id === kit.id ? kit : p)));
        setKitStatus(`Updated ${kit.name}.`);
      } else {
        const kit = await api.post<GearPreset>("/gear-presets", body);
        setPresets((ps) => [...ps, kit]);
        setKitStatus(`Saved ${kit.name}.`);
      }
    } catch (err) {
      setKitStatus(err instanceof Error ? err.message : "Couldn't save the kit");
    }
  }

  async function handleDeleteKit(kit: GearPreset) {
    if (!window.confirm(`Delete the ${kit.name} kit? Dives that used it keep their gear.`)) return;
    try {
      await api.del(`/gear-presets/${kit.id}`);
      setPresets((ps) => ps.filter((p) => p.id !== kit.id));
      setKitStatus(null);
    } catch (err) {
      setKitStatus(err instanceof Error ? err.message : "Couldn't delete the kit");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await api.put(`/dives/${diveId}/gear`, formValues());
      setStatus("Saved.");
      onSaved();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't save your gear");
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    try {
      await api.del(`/dives/${diveId}/gear`);
      setWeight("");
      setSuit("");
      setTank("");
      setStatus(null);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-xl border border-surface-border bg-surface-raised/80">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-surface-border px-5 py-3">
          <h2 className="text-sm font-medium text-foam">Weights and exposure suit</h2>
          {last && !gear && (
            <button type="button" onClick={fillFromLast} className="text-xs text-aqua hover:text-foam">
              Same as {formatDate(last.started_at)}
            </button>
          )}
        </div>
        {presets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-surface-border px-5 py-3">
            <span className="mr-1 text-xs text-murk">Your kits</span>
            {presets.map((kit) => (
              <span key={kit.id} className="inline-flex items-center rounded-full border border-surface-border bg-surface text-xs">
                <button
                  type="button"
                  onClick={() => applyKit(kit)}
                  title={kitSummary(kit, f)}
                  className="rounded-l-full py-1 pl-3 pr-2 text-foam transition-colors hover:text-aqua"
                >
                  {kit.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteKit(kit)}
                  aria-label={`Delete the ${kit.name} kit`}
                  className="rounded-r-full py-1 pl-1 pr-2.5 text-murk transition-colors hover:text-coral"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4 px-5 py-4">
          <label className="space-y-1 text-xs text-murk">
            <span className="block">Weight ({f.weightUnit})</span>
            <input
              type="number" min={0} max={f.toWeight(30)} step="any"
              value={weight} onChange={(e) => setWeight(e.target.value)}
              className={`w-24 text-right ${fieldClass}`}
            />
          </label>
          <label className="space-y-1 text-xs text-murk">
            <span className="block">Exposure suit</span>
            <select value={suit} onChange={(e) => setSuit(e.target.value as Suit | "")} className={fieldClass}>
              <option value="">Not noted</option>
              {SUITS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-murk">
            <span className="block">Tank</span>
            <select
              value={tank ?? ""}
              onChange={(e) => setTank(e.target.value as GearInput["tank_material"] | "")}
              className={fieldClass}
            >
              <option value="">Not noted</option>
              <option value="aluminum">Aluminum</option>
              <option value="steel">Steel</option>
            </select>
          </label>
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-lagoon px-4 py-1.5 text-sm font-medium text-abyss transition-colors hover:bg-aqua disabled:opacity-50"
            >
              Save
            </button>
            {gear && (
              <button type="button" onClick={handleClear} disabled={busy} className="text-sm text-aqua hover:text-foam">
                Clear
              </button>
            )}
          </div>
        </div>
        <p className="px-5 pb-4 text-xs text-murk">
          Aluminum tanks get floaty as they empty and steel ones don't, so they need different weighting.
          The debrief compares your weight with your buoyancy from dive to dive.
          {status && <span className="ml-2 text-mist" role="status">{status}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-3 border-t border-surface-border px-5 py-3">
          <label className="flex items-center gap-2 text-xs text-murk">
            <span>Save these as a kit</span>
            <input
              value={kitName}
              maxLength={40}
              placeholder="e.g. Quarry, 7 mm"
              onChange={(e) => setKitName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (kitName.trim()) handleSaveKit();
                }
              }}
              className={`w-44 ${fieldClass}`}
            />
          </label>
          <button
            type="button"
            onClick={handleSaveKit}
            disabled={!kitName.trim()}
            className="text-sm text-aqua hover:text-foam disabled:opacity-40"
          >
            {sameName ? `Update ${sameName.name}` : "Save kit"}
          </button>
          {kitStatus && <span className="text-xs text-mist" role="status">{kitStatus}</span>}
        </div>
      </form>

      {history && history.length > 0 && (
        <section className="overflow-x-auto rounded-xl border border-surface-border bg-surface-raised/80">
          <h2 className="border-b border-surface-border px-5 py-3 text-sm font-medium text-foam">Your weighting</h2>
          <table className="w-full min-w-[520px] text-left text-sm tabular-nums">
            <thead className="text-xs text-murk">
              <tr>
                <th className="px-5 py-2 font-medium">Dive</th>
                <th className="px-5 py-2 font-medium">Site</th>
                <th className="px-5 py-2 text-right font-medium">Weight</th>
                <th className="px-5 py-2 font-medium">Suit</th>
                <th className="px-5 py-2 font-medium">Tank</th>
                <th className="px-5 py-2 text-right font-medium">Buoyancy</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.dive_id} className={`border-t border-surface-border/50 ${h.dive_id === diveId ? "bg-lagoon/10" : ""}`}>
                  <td className="px-5 py-2">
                    <Link to={`/dives/${h.dive_id}?tab=gear`} className="text-aqua hover:text-foam">
                      {formatDate(h.started_at)}
                    </Link>
                  </td>
                  <td className="px-5 py-2 text-mist">{h.site_name ?? "—"}</td>
                  <td className="px-5 py-2 text-right text-foam">
                    {h.weight_kg === null ? "—" : `${+f.toWeight(h.weight_kg).toFixed(1)} ${f.weightUnit}`}
                  </td>
                  <td className="px-5 py-2 text-mist">{h.suit ? SUIT_LABELS[h.suit] : "—"}</td>
                  <td className="px-5 py-2 text-mist">{h.tank_material ? TANKS[h.tank_material] : "—"}</td>
                  <td className="px-5 py-2 text-right text-foam">{formatScore(h.buoyancy_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

/** What a kit holds, for its tooltip. */
function kitSummary(kit: GearInput, f: ReturnType<typeof useFormat>): string {
  const parts = [
    kit.weight_kg === null ? null : `${+f.toWeight(kit.weight_kg).toFixed(1)} ${f.weightUnit}`,
    kit.suit ? SUIT_LABELS[kit.suit] : null,
    kit.tank_material ? TANKS[kit.tank_material] : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "Nothing noted";
}
