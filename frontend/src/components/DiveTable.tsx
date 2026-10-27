import { Fragment, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Sun } from "lucide-react";
import type { DiveSummary, Skill } from "../api/types";
import { Toggle } from "./Toggle";
import { SHORT_INTERVAL_S, formatDate, formatDuration, formatHours, formatTime } from "../lib/format";
import { formatScore } from "../lib/skills";
import { useFormat } from "../lib/units";
import { defaultDir, type GroupKey, type SortDir, type SortKey } from "../lib/logbookView";

const GROUPS: { value: GroupKey; label: string }[] = [
  { value: "none", label: "None" },
  { value: "day", label: "Day" },
  { value: "month", label: "Month" },
  { value: "site", label: "Site" },
  { value: "sea_life", label: "Sea life" },
  { value: "buddy", label: "Buddy" },
];

interface Column {
  key: SortKey;
  label: string;
  sortLabel: string; // in the sort menu
  right?: boolean;
}

const COLUMNS: Column[] = [
  { key: "date", label: "Date", sortLabel: "Date" },
  { key: "site", label: "Site", sortLabel: "Site" },
  { key: "duration", label: "Duration", sortLabel: "Duration", right: true },
  { key: "max_depth", label: "Max depth", sortLabel: "Max depth", right: true },
  { key: "avg_depth", label: "Avg depth", sortLabel: "Average depth", right: true },
  { key: "temp", label: "Water", sortLabel: "Water temperature", right: true },
  { key: "ascent", label: "Ascent", sortLabel: "Ascent score", right: true },
  { key: "stop", label: "Stop", sortLabel: "Safety stop score", right: true },
  { key: "buoyancy", label: "Buoyancy", sortLabel: "Buoyancy score", right: true },
  { key: "air", label: "Air", sortLabel: "Air score", right: true },
  { key: "overall", label: "Overall", sortLabel: "Overall score", right: true },
];

interface Props {
  dives: DiveSummary[];
  siteLabel: (d: DiveSummary) => string;
  sort: SortKey;
  dir: SortDir;
  group: GroupKey;
  onChange: (change: { sort?: SortKey; dir?: SortDir; group?: GroupKey }) => void;
}

interface Group {
  key: string;
  label: string;
  dives: DiveSummary[];
}

export function DiveTable({ dives, siteLabel, sort, dir, group, onChange }: Props) {
  const f = useFormat();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sorted = sortDives(dives, sort, dir, siteLabel);
  const groups = group === "none" ? [{ key: "", label: "", dives: sorted }] : groupDives(sorted, group, sort, dir, siteLabel);
  const skillScore = (d: DiveSummary, skill: Skill) =>
    formatScore(d.scores.find((s) => s.skill === skill)?.score ?? null);
  const toggle = (key: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const sortBy = (key: SortKey) =>
    onChange(key === sort ? { dir: dir === "asc" ? "desc" : "asc" } : { sort: key, dir: defaultDir(key) });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-murk">
          <label htmlFor="dive-group">Group</label>
          {/* Buttons where they fit on one line, a menu on phones */}
          <div className="hidden sm:block">
            <Toggle label="Group dives by" value={group} options={GROUPS} onChange={(g) => onChange({ group: g })} />
          </div>
          <select
            id="dive-group"
            value={group}
            onChange={(e) => onChange({ group: e.target.value as GroupKey })}
            className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foam outline-none transition-colors focus:border-lagoon sm:hidden"
          >
            {GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.value === "none" ? "No grouping" : g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-murk">
          <label htmlFor="dive-sort">Sort</label>
          <select
            id="dive-sort"
            value={sort}
            onChange={(e) => sortBy(e.target.value as SortKey)}
            className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foam outline-none transition-colors focus:border-lagoon"
          >
            {COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.sortLabel}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onChange({ dir: dir === "asc" ? "desc" : "asc" })}
            aria-label={dir === "asc" ? "Ascending; switch to descending" : "Descending; switch to ascending"}
            title={dir === "asc" ? "Ascending" : "Descending"}
            className="rounded-lg border border-surface-border p-1.5 text-mist transition-colors hover:border-lagoon hover:text-foam"
          >
            {dir === "asc" ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface-raised/80">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b border-surface-border text-xs text-murk">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  aria-sort={c.key === sort ? (dir === "asc" ? "ascending" : "descending") : undefined}
                  className={`px-4 py-3 font-medium ${c.right ? "text-right" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => sortBy(c.key)}
                    className={`inline-flex items-center gap-1 transition-colors hover:text-foam ${
                      c.key === sort ? "text-foam" : ""
                    }`}
                  >
                    {c.label}
                    {c.key === sort && (dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {groups.map((g) => {
              const closed = collapsed.has(`${group}:${g.key}`);
              return (
                <Fragment key={g.key}>
                  {group !== "none" && (
                    <GroupHeader group={g} closed={closed} onToggle={() => toggle(`${group}:${g.key}`)} />
                  )}
                  {!closed &&
                    g.dives.map((d, i) => {
                      // Surface intervals only make sense with the day's dives side by side, in time order
                      const before = sort === "date" && dir === "asc" ? g.dives[i - 1] : g.dives[i + 1];
                      const showInterval =
                        sort === "date" && d.surface_interval_s !== null && before?.id === d.previous_dive_id;
                      const interval = showInterval && <SurfaceInterval seconds={d.surface_interval_s!} />;
                      return (
                        <Fragment key={d.id}>
                          {dir === "asc" && interval}
                          <tr
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
                            <td className="px-4 py-3 text-right text-foam">{f.depth(d.max_depth_m)}</td>
                            <td className="px-4 py-3 text-right text-mist">{f.depth(d.avg_depth_m)}</td>
                            <td className="px-4 py-3 text-right text-mist">{f.temp(d.min_temp_k)}</td>
                            <td className="px-4 py-3 text-right text-mist">{skillScore(d, "ascent")}</td>
                            <td className="px-4 py-3 text-right text-mist">{skillScore(d, "stop")}</td>
                            <td className="px-4 py-3 text-right text-mist">{skillScore(d, "buoyancy")}</td>
                            <td className="px-4 py-3 text-right text-mist">{skillScore(d, "air")}</td>
                            <td className="px-4 py-3 text-right font-medium text-foam">
                              {formatScore(d.overall_score)}
                            </td>
                          </tr>
                          {dir === "desc" && interval}
                        </Fragment>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupHeader({ group, closed, onToggle }: { group: Group; closed: boolean; onToggle: () => void }) {
  const scored = group.dives.filter((d) => d.overall_score !== null);
  const avg = scored.length
    ? Math.round(scored.reduce((sum, d) => sum + d.overall_score!, 0) / scored.length)
    : null;
  const n = group.dives.length;
  return (
    <tr className="border-b border-surface-border bg-surface/60">
      <td colSpan={COLUMNS.length} className="px-2 py-0">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!closed}
          className="flex w-full items-center gap-2 px-2 py-2 text-left text-sm transition-colors hover:text-aqua"
        >
          {closed ? <ChevronRight size={14} className="text-murk" /> : <ChevronDown size={14} className="text-murk" />}
          <span className="font-medium text-foam">{group.label}</span>
          <span className="text-xs text-murk">
            {n} dive{n === 1 ? "" : "s"}
            {avg !== null && ` · average ${avg}`}
          </span>
        </button>
      </td>
    </tr>
  );
}

function SurfaceInterval({ seconds }: { seconds: number }) {
  const short = seconds < SHORT_INTERVAL_S;
  return (
    <tr className="border-b border-surface-border/60 bg-lagoon/5 text-xs">
      <td colSpan={COLUMNS.length} className={`px-4 py-1.5 ${short ? "text-coral" : "text-murk"}`}>
        <span className="inline-flex items-center gap-1.5">
          <Sun size={12} />
          {formatHours(seconds)} surface interval{short && ": short, aim for an hour"}
        </span>
      </td>
    </tr>
  );
}

function sortValue(d: DiveSummary, key: SortKey, siteLabel: Props["siteLabel"]): number | string | null {
  switch (key) {
    case "date": return d.started_at;
    case "site": return siteLabel(d).toLocaleLowerCase();
    case "duration": return d.duration_s;
    case "max_depth": return d.max_depth_m;
    case "avg_depth": return d.avg_depth_m;
    case "temp": return d.min_temp_k;
    case "overall": return d.overall_score;
    default: return d.scores.find((s) => s.skill === key)?.score ?? null;
  }
}

function sortDives(dives: DiveSummary[], key: SortKey, dir: SortDir, siteLabel: Props["siteLabel"]) {
  const sign = dir === "asc" ? 1 : -1;
  return [...dives].sort((a, b) => {
    const x = sortValue(a, key, siteLabel);
    const y = sortValue(b, key, siteLabel);
    // N/A and missing readings go last either way
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    const c = x < y ? -1 : x > y ? 1 : 0;
    // Ties keep the newest dive first
    return c * sign || b.started_at.localeCompare(a.started_at);
  });
}

const NOTHING = "\u0000none"; // sorts the "not noted" group last

function groupDives(
  dives: DiveSummary[], group: GroupKey, sort: SortKey, dir: SortDir, siteLabel: Props["siteLabel"],
): Group[] {
  const map = new Map<string, Group>();
  const add = (key: string, label: string, d: DiveSummary) => {
    if (!map.has(key)) map.set(key, { key, label, dives: [] });
    map.get(key)!.dives.push(d);
  };
  for (const d of dives) {
    // Start times are wall-clock times tagged as UTC (see lib/format)
    if (group === "day") add(d.started_at.slice(0, 10), formatDate(d.started_at), d);
    else if (group === "month") add(d.started_at.slice(0, 7), formatMonth(d.started_at), d);
    else if (group === "site") add(d.site_id === null ? NOTHING : `site-${d.site_id}`, siteLabel(d), d);
    else if (group === "buddy") {
      if (d.buddy) add(d.buddy.toLocaleLowerCase(), d.buddy, d);
      else add(NOTHING, "No buddy noted", d);
    } else if (group === "sea_life") {
      // A dive shows under each animal seen on it
      if (d.sea_life.length === 0) add(NOTHING, "No sea life noted", d);
      for (const s of d.sea_life) add(s.toLocaleLowerCase(), s, d);
    }
  }
  const groups = [...map.values()];
  const last = (g: Group) => (g.key === NOTHING ? 1 : 0);
  if (group === "day" || group === "month") {
    // Dates follow the sort when it's by date, and are newest first otherwise
    const sign = sort === "date" && dir === "asc" ? 1 : -1;
    return groups.sort((a, b) => sign * a.key.localeCompare(b.key));
  }
  if (group === "sea_life") {
    // Most often seen first
    return groups.sort((a, b) => last(a) - last(b) || b.dives.length - a.dives.length || a.label.localeCompare(b.label));
  }
  return groups.sort((a, b) => last(a) - last(b) || a.label.localeCompare(b.label));
}

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", timeZone: "UTC" });
}
