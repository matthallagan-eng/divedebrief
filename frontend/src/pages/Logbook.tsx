import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDownToLine, Award, Fish, Timer, Waves } from "lucide-react";
import { api } from "../api/client";
import type { DiveSummary, SettingsResponse, Skill, Trends } from "../api/types";
import { Habits } from "../components/Habits";
import { StatCard } from "../components/StatCard";
import { formatScore } from "../lib/skills";
import { formatDate, formatDepth, formatDuration, formatHours, formatTemp, formatTime } from "../lib/format";

export default function Logbook() {
  const [allDives, setAllDives] = useState<DiveSummary[] | null>(null);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [trends, setTrends] = useState<{ site: string; data: Trends } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // "" = every site, "unknown" = dives without GPS, otherwise a site id
  const site = params.get("site") ?? "";

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
  const skillScore = (d: DiveSummary, skill: Skill) =>
    formatScore(d.scores.find((s) => s.skill === skill)?.score ?? null);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foam">Logbook</h1>
          <p className="mt-1 text-sm text-mist">Every dive you've surfaced from, newest first.</p>
        </div>
        {(siteNames.size > 1 || (siteNames.size > 0 && hasUnknown)) && (
          <label className="flex items-center gap-2 text-sm text-mist">
            Site
            <select
              value={site}
              onChange={(e) => setParams(e.target.value ? { site: e.target.value } : {})}
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Fish size={14} />} label="Dives logged" value={String(dives.length)} />
        <StatCard icon={<Timer size={14} />} label="Time underwater" value={formatHours(totalTime)} />
        <StatCard
          icon={<ArrowDownToLine size={14} />}
          label="Deepest dive"
          value={formatDepth(deepest.max_depth_m)}
          sub={formatDate(deepest.started_at)}
        />
        <StatCard
          icon={<Award size={14} />}
          label="Average score"
          value={formatScore(recentAvg)}
          sub={scored.length ? `last ${scored.length} scored dive${scored.length === 1 ? "" : "s"}` : undefined}
        />
      </div>

      {trends?.site === site && (
        <Habits
          trends={trends.data}
          siteNames={siteNames}
          target={settings.values.ascent_target_m_per_min}
          violation={settings.values.ascent_violation_m_per_min}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface-raised/80">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b border-surface-border text-xs text-murk">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Site</th>
              <th className="px-4 py-3 text-right font-medium">Duration</th>
              <th className="px-4 py-3 text-right font-medium">Max depth</th>
              <th className="px-4 py-3 text-right font-medium">Avg depth</th>
              <th className="px-4 py-3 text-right font-medium">Water</th>
              <th className="px-4 py-3 text-right font-medium">Ascent</th>
              <th className="px-4 py-3 text-right font-medium">Stop</th>
              <th className="px-4 py-3 text-right font-medium">Buoyancy</th>
              <th className="px-4 py-3 text-right font-medium">Air</th>
              <th className="px-4 py-3 text-right font-medium">Overall</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {dives.map((d) => (
              <tr
                key={d.id}
                onClick={() => navigate(`/dives/${d.id}`)}
                className="cursor-pointer border-b border-surface-border/60 transition-colors last:border-0 hover:bg-lagoon/5"
              >
                <td className="px-4 py-3">
                  <Link to={`/dives/${d.id}`} className="text-foam hover:text-aqua">
                    {formatDate(d.started_at)}
                  </Link>
                  <span className="ml-2 text-murk">{formatTime(d.started_at)}</span>
                </td>
                <td className="max-w-40 truncate px-4 py-3 text-mist">{siteLabel(d)}</td>
                <td className="px-4 py-3 text-right text-mist">{formatDuration(d.duration_s)}</td>
                <td className="px-4 py-3 text-right text-foam">{formatDepth(d.max_depth_m)}</td>
                <td className="px-4 py-3 text-right text-mist">{formatDepth(d.avg_depth_m)}</td>
                <td className="px-4 py-3 text-right text-mist">{formatTemp(d.min_temp_k)}</td>
                <td className="px-4 py-3 text-right text-mist">{skillScore(d, "ascent")}</td>
                <td className="px-4 py-3 text-right text-mist">{skillScore(d, "stop")}</td>
                <td className="px-4 py-3 text-right text-mist">{skillScore(d, "buoyancy")}</td>
                <td className="px-4 py-3 text-right text-mist">{skillScore(d, "air")}</td>
                <td className="px-4 py-3 text-right font-medium text-foam">{formatScore(d.overall_score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
