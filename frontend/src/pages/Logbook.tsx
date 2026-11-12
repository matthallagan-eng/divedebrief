import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDownToLine, Award, Fish, Thermometer, Timer, Waves } from "lucide-react";
import { api } from "../api/client";
import type { DiveSummary, SettingsResponse, Trends } from "../api/types";
import { DiveTable } from "../components/DiveTable";
import {
  GROUP_KEYS, SORT_KEYS, defaultDir, type GroupKey, type SortDir, type SortKey,
} from "../lib/logbookView";
import { Habits } from "../components/Habits";
import { LogStats } from "../components/LogStats";
import { Tabs } from "../components/Tabs";
import { StatCard } from "../components/StatCard";
import { formatScore } from "../lib/skills";
import { formatDate, formatHours } from "../lib/format";
import { useFormat } from "../lib/units";

export default function Logbook() {
  const f = useFormat();
  const [allDives, setAllDives] = useState<DiveSummary[] | null>(null);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [trends, setTrends] = useState<{ site: string; data: Trends } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  // "" = every site, "unknown" = dives without GPS, otherwise a site id
  const site = params.get("site") ?? "";
  const tab = TABS.some((t) => t.key === params.get("tab")) ? (params.get("tab") as TabKey) : "dives";
  const sort = SORT_KEYS.find((k) => k === params.get("sort")) ?? "date";
  const dir: SortDir = params.get("dir") === "asc" || params.get("dir") === "desc" ? (params.get("dir") as SortDir) : defaultDir(sort);
  const group = GROUP_KEYS.find((k) => k === params.get("group")) ?? "none";
  // All live in the URL, so a filtered, sorted or grouped view can be bookmarked or linked
  const update = (change: { site?: string; tab?: TabKey; sort?: SortKey; dir?: SortDir; group?: GroupKey }) => {
    const next = { site, tab, sort, dir, group, ...change };
    const p: Record<string, string> = {};
    if (next.site) p.site = next.site;
    if (next.tab !== "dives") p.tab = next.tab;
    if (next.sort !== "date") p.sort = next.sort;
    if (next.dir !== defaultDir(next.sort)) p.dir = next.dir;
    if (next.group !== "none") p.group = next.group;
    setParams(p, { replace: true });
  };

  useEffect(() => {
    Promise.all([api.get<DiveSummary[]>("/dives"), api.get<SettingsResponse>("/settings")])
      .then(([d, s]) => {
        setAllDives(d);
        setSettings(s);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    api
      .get<Trends>(site ? `/trends?site=${encodeURIComponent(site)}` : "/trends")
      .then((data) => setTrends({ site, data }))
      .catch((e: Error) => setError(e.message));
  }, [site]);

  if (error) return <p className="text-sm text-mist">Couldn't reach the API: {error}</p>;
  if (!allDives || !settings) return <p className="text-sm text-murk">Descending…</p>;
  if (allDives.length === 0) return <EmptyReef />;

  const siteNames = new Map<number, string>();
  for (const d of allDives) if (d.site_id !== null) siteNames.set(d.site_id, d.site_name ?? "Unnamed site");
  const hasUnknown = allDives.some((d) => d.site_id === null);
  const dives = allDives.filter((d) =>
    site === "" ? true : site === "unknown" ? d.site_id === null : d.site_id === Number(site),
  );
  const siteLabel = (d: DiveSummary) => (d.site_id === null ? "Unknown" : siteNames.get(d.site_id)!);

  if (dives.length === 0) {
    // A stale ?site= link, e.g. after deleting the site's last dive
    return (
      <p className="text-sm text-mist">
        No dives at this site.{" "}
        <Link to="/logbook" className="text-aqua hover:text-foam">
          Show all sites
        </Link>
      </p>
    );
  }

  const deepest = dives.reduce((a, b) => (b.max_depth_m > a.max_depth_m ? b : a));
  const totalTime = dives.reduce((sum, d) => sum + d.duration_s, 0);
  const scored = dives.filter((d) => d.overall_score !== null).slice(0, 10);
  const recentAvg = scored.length
    ? Math.round(scored.reduce((sum, d) => sum + d.overall_score!, 0) / scored.length)
    : null;
  const temps = dives.flatMap((d) => (d.min_temp_k === null ? [] : [d.min_temp_k]));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foam">Logbook</h1>
          <p className="mt-1 text-sm text-mist">Every dive you've surfaced from.</p>
        </div>
        {(siteNames.size > 1 || (siteNames.size > 0 && hasUnknown)) && (
          <label className="flex items-center gap-2 text-sm text-mist">
            Site
            <select
              value={site}
              onChange={(e) => update({ site: e.target.value })}
              className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foam outline-none transition-colors focus:border-lagoon"
            >
              <option value="">All sites</option>
              {[...siteNames].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
              {hasUnknown && <option value="unknown">Unknown site</option>}
            </select>
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={<Fish size={14} />} label="Dives logged" value={String(dives.length)} />
        <StatCard icon={<Timer size={14} />} label="Time underwater" value={formatHours(totalTime)} />
        <StatCard
          icon={<ArrowDownToLine size={14} />}
          label="Deepest dive"
          value={f.depth(deepest.max_depth_m)}
          sub={formatDate(deepest.started_at)}
        />
        <StatCard
          icon={<Thermometer size={14} />}
          label="Water temperature"
          value={temps.length ? f.tempRange(Math.min(...temps), Math.max(...temps)) : "—"}
          sub={temps.length > 1 ? "coldest reading, by dive" : undefined}
        />
        <StatCard
          icon={<Award size={14} />}
          label="Average score"
          value={formatScore(recentAvg)}
          sub={scored.length ? `last ${scored.length} scored dive${scored.length === 1 ? "" : "s"}` : undefined}
        />
      </div>

      <Tabs
        label="Logbook sections"
        active={tab}
        onChange={(t) => update({ tab: t })}
        tabs={TABS.map((t) => ({ ...t, badge: t.key === "dives" ? String(dives.length) : undefined }))}
      >
        {tab === "habits" &&
          (trends?.site === site ? (
            <Habits
              trends={trends.data}
              siteNames={siteNames}
              target={settings.values.ascent_target_m_per_min}
              violation={settings.values.ascent_violation_m_per_min}
            />
          ) : (
            <p className="text-sm text-murk">Loading trends…</p>
          ))}
        {tab === "stats" && <LogStats dives={dives} />}
        {tab === "dives" && (
          <DiveTable
            dives={dives}
            siteLabel={siteLabel}
            sort={sort}
            dir={dir}
            group={group}
            onChange={update}
          />
        )}
      </Tabs>
    </div>
  );
}

type TabKey = "dives" | "habits" | "stats";

// Summary on top, details in tabs: the dive list, trends, and records and
// averages, the way Subsurface and MacDive split a logbook
const TABS: { key: TabKey; label: string }[] = [
  { key: "dives", label: "Dives" },
  { key: "habits", label: "Habits" },
  { key: "stats", label: "Stats" },
];

function EmptyReef() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-lagoon/10 text-aqua">
        <Waves size={28} />
      </div>
      <h1 className="mt-6 text-xl font-semibold text-foam">The reef is quiet</h1>
      <p className="mt-2 text-sm text-mist">
        No dives logged yet. Upload a .fit file from your Garmin, or a UDDF export from Subsurface.
      </p>
      <Link
        to="/upload"
        className="mt-6 inline-flex rounded-lg bg-lagoon px-4 py-2 text-sm font-medium text-abyss transition-colors hover:bg-aqua"
      >
        Log your first dive
      </Link>
    </div>
  );
}
