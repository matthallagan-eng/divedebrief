import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowDownToLine, ChevronLeft, Gauge, MapPin, Thermometer, Timer, Trash2 } from "lucide-react";
import { api } from "../api/client";
import type { DiveDetail as Dive, Region, ScoringSettings, SettingsResponse, Skill } from "../api/types";
import { DiveCharts } from "../components/DiveCharts";
import { DiveNotes } from "../components/DiveNotes";
import { Scorecard } from "../components/Scorecard";
import { StatCard } from "../components/StatCard";
import { Tabs } from "../components/Tabs";
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
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? (params.get("tab") as TabKey) : "profile";
  const setTab = (key: TabKey) => setParams(key === "profile" ? {} : { tab: key }, { replace: true });

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
        onSelect={(skill) => {
          setSelected(skill);
          if (skill) setTab(skill === "air" ? "air" : "profile");
        }}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<ArrowDownToLine size={14} />} label="Max depth" value={formatDepth(dive.max_depth_m)} />
        <StatCard icon={<Timer size={14} />} label="Duration" value={formatDuration(dive.duration_s)} />
        <StatCard
          icon={<Thermometer size={14} />}
          label="Water temperature"
          value={formatTemp(dive.min_temp_k)}
          // The coldest reading: the watch's sensor takes minutes to cool after it enters the water,
          // so its warmest readings are the air, not the water
          sub="coldest reading"
        />
        <StatCard icon={<Gauge size={14} />} label="Average depth" value={formatDepth(dive.avg_depth_m)} />
      </div>

      <Tabs
        label="Dive details"
        active={tab}
        onChange={setTab}
        tabs={TABS.map((t) => ({ ...t, badge: t.key === "data" ? String(dive.samples.length) : undefined }))}
      >
        {tab === "profile" && (
          <div className="space-y-6">
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
          </div>
        )}
        {tab === "notes" && (
          <DiveNotes key={`${dive.id}-${dive.notes?.updated_at}`} diveId={dive.id} notes={dive.notes} onSaved={load} />
        )}
        {tab === "air" && <TankForm key={dive.id} diveId={dive.id} tank={dive.tank} onSaved={load} />}
        {tab === "data" && <DiveData dive={dive} />}
      </Tabs>
    </div>
  );
}

type TabKey = "profile" | "notes" | "air" | "data";

// Summary on top and details in tabs, as Subsurface, Garmin and MacDive lay out a dive
const TABS: { key: TabKey; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "notes", label: "Notes" },
  { key: "air", label: "Air" },
  { key: "data", label: "Data" },
];

function DiveData({ dive }: { dive: Dive }) {
  const rows: [string, string][] = [
    ["Dive computer", [dive.computer_model, dive.computer_serial && `#${dive.computer_serial}`].filter(Boolean).join(" ") || "Unknown"],
    ["Imported from", dive.source === "fit" ? "Garmin FIT file" : "UDDF export"],
    ["Water type", dive.site?.water_type ? `${dive.site.water_type} (set for the site)` : dive.water_type ?? "Not recorded"],
    ["Entry point", coords(dive.entry_latitude, dive.entry_longitude)],
    ["Exit point", coords(dive.exit_latitude, dive.exit_longitude)],
  ];
  return (
    <div className="space-y-6">
      <dl className="grid gap-x-8 gap-y-3 rounded-xl border border-surface-border bg-surface-raised/80 p-5 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-murk">{label}</dt>
            <dd className="text-sm text-foam first-letter:uppercase">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="rounded-xl border border-surface-border bg-surface-raised/80">
        <h2 className="border-b border-surface-border px-5 py-3 text-sm font-medium text-foam">
          Samples ({dive.samples.length})
        </h2>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="sticky top-0 bg-surface-raised text-xs text-murk">
              <tr>
                <th className="px-5 py-2 font-medium">Time</th>
                <th className="px-5 py-2 text-right font-medium">Depth</th>
                <th className="px-5 py-2 text-right font-medium">Temperature</th>
                <th className="px-5 py-2 text-right font-medium">Heart rate</th>
              </tr>
            </thead>
            <tbody>
              {dive.samples.map((x) => (
                <tr key={x.t_s} className="border-t border-surface-border/50">
                  <td className="px-5 py-1.5 font-mono text-mist">{formatDuration(x.t_s)}</td>
                  <td className="px-5 py-1.5 text-right text-foam">{formatDepth(x.depth_m)}</td>
                  <td className="px-5 py-1.5 text-right text-mist">{formatTemp(x.temp_k)}</td>
                  <td className="px-5 py-1.5 text-right text-mist">{x.heart_rate === null ? "—" : `${x.heart_rate} bpm`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function coords(lat: number | null, lon: number | null): string {
  if (lat === null || lon === null) return "No GPS fix";
  return `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? "E" : "W"}`;
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
