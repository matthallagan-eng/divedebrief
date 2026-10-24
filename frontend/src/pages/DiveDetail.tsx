import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDownToLine, ChevronLeft, Gauge, MapPin, Thermometer, Timer, Trash2 } from "lucide-react";
import { api } from "../api/client";
import type { DiveDetail as Dive, Region, ScoringSettings, SettingsResponse, Skill } from "../api/types";
import { DiveCharts } from "../components/DiveCharts";
import { Scorecard } from "../components/Scorecard";
import { StatCard } from "../components/StatCard";
import { TankForm } from "../components/TankForm";
import { formatDate, formatDepth, formatDuration, formatTemp, formatTime } from "../lib/format";
import { SKILL_NAMES } from "../lib/skills";

export default function DiveDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dive, setDive] = useState<Dive | null>(null);
  const [settings, setSettings] = useState<ScoringSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Skill | null>("ascent");

  const load = useCallback(() => {
    Promise.all([api.get<Dive>(`/dives/${id}`), api.get<SettingsResponse>("/settings")])
      .then(([d, s]) => {
        setDive(d);
        setSettings(s.values);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  async function handleDelete() {
    if (!dive || !confirm("Delete this dive from your logbook?")) return;
    await api.del(`/dives/${dive.id}`);
    navigate("/logbook");
  }

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-mist">{error}</p>
      </div>
    );
  }
  if (!dive || !settings) return <p className="text-sm text-murk">Descending…</p>;

  const regions = dive.scores.find((s) => s.skill === selected)?.regions ?? [];
  const ascentRegions = dive.scores.find((s) => s.skill === "ascent")?.regions ?? [];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <BackLink />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foam">
              {formatDate(dive.started_at)}
              <span className="ml-3 text-lg font-normal text-murk">{formatTime(dive.started_at)}</span>
            </h1>
            <p className="mt-1 text-sm text-mist">
              {[dive.computer_model, dive.computer_serial && `#${dive.computer_serial}`]
                .filter(Boolean)
                .join(" ") || "Unknown dive computer"}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-mist">
              <MapPin size={14} className="text-murk" />
              {dive.site ? (
                <>
                  {dive.site.name ?? "Unnamed site"}
                  <Link to={`/?dive=${dive.id}`} className="text-aqua hover:text-foam">
                    Show on map
                  </Link>
                </>
              ) : (
                "Unknown site: no GPS position"
              )}
            </p>
          </div>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-sm text-mist transition-colors hover:border-coral/60 hover:text-foam"
          >
            <Trash2 size={14} />
            Delete dive
          </button>
        </div>
      </div>

      <Scorecard
        scores={dive.scores}
        overall={dive.overall_score}
        selected={selected}
        onSelect={setSelected}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<ArrowDownToLine size={14} />} label="Max depth" value={formatDepth(dive.max_depth_m)} />
        <StatCard icon={<Gauge size={14} />} label="Average depth" value={formatDepth(dive.avg_depth_m)} />
        <StatCard icon={<Timer size={14} />} label="Duration" value={formatDuration(dive.duration_s)} />
        <StatCard icon={<Thermometer size={14} />} label="Coldest water" value={formatTemp(dive.min_temp_k)} />
      </div>

      <TankForm key={dive.id} diveId={dive.id} tank={dive.tank} onSaved={load} />

      <DiveCharts
        profile={dive.profile}
        skill={selected}
        regions={regions}
        target={settings.ascent_target_m_per_min}
        violation={settings.ascent_violation_m_per_min}
      />

      <RegionTable
        title={`${SKILL_NAMES.ascent}: stretches over ${settings.ascent_target_m_per_min} m/min`}
        empty="None. Every ascent stayed within your target."
        regions={ascentRegions}
      />

      <details className="rounded-xl border border-surface-border bg-surface-raised/80">
        <summary className="cursor-pointer px-5 py-3 text-sm text-mist hover:text-foam">
          Profile data ({dive.samples.length} samples)
        </summary>
        <div className="max-h-80 overflow-y-auto border-t border-surface-border">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="sticky top-0 bg-surface-raised text-xs text-murk">
              <tr>
                <th className="px-5 py-2 font-medium">Time</th>
                <th className="px-5 py-2 text-right font-medium">Depth</th>
                <th className="px-5 py-2 text-right font-medium">Temperature</th>
              </tr>
            </thead>
            <tbody>
              {dive.samples.map((s) => (
                <tr key={s.t_s} className="border-t border-surface-border/50">
                  <td className="px-5 py-1.5 font-mono text-mist">{formatDuration(s.t_s)}</td>
                  <td className="px-5 py-1.5 text-right text-foam">{formatDepth(s.depth_m)}</td>
                  <td className="px-5 py-1.5 text-right text-mist">{formatTemp(s.temp_k)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/logbook" className="inline-flex items-center gap-1 text-sm text-murk hover:text-mist">
      <ChevronLeft size={14} />
      Logbook
    </Link>
  );
}

function RegionTable({ title, empty, regions }: { title: string; empty: string; regions: Region[] }) {
  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised/80">
      <h2 className="border-b border-surface-border px-5 py-3 text-sm font-medium text-foam">{title}</h2>
      {regions.length === 0 ? (
        <p className="px-5 py-4 text-sm text-mist">{empty}</p>
      ) : (
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-xs text-murk">
            <tr>
              <th className="px-5 py-2 font-medium">From</th>
              <th className="px-5 py-2 font-medium">To</th>
              <th className="px-5 py-2 text-right font-medium">Lasted</th>
              <th className="px-5 py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((r) => (
              <tr key={r.start_s} className="border-t border-surface-border/50">
                <td className="px-5 py-2 font-mono text-mist">{formatDuration(r.start_s)}</td>
                <td className="px-5 py-2 font-mono text-mist">{formatDuration(r.end_s)}</td>
                <td className="px-5 py-2 text-right text-mist">{Math.round(r.end_s - r.start_s)} s</td>
                <td className="px-5 py-2 text-foam">
                  {r.label}
                  {r.severity === "violation" && <span className="ml-2 text-xs text-mist">· over violation limit</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
