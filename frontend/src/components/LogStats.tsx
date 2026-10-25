import { Link } from "react-router-dom";
import type { DiveSummary, Skill } from "../api/types";
import { formatDate, formatDuration } from "../lib/format";
import { useFormat } from "../lib/units";
import type { Format } from "../lib/units";
import { SKILL_NAMES, formatScore } from "../lib/skills";

const SKILLS: Skill[] = ["ascent", "stop", "buoyancy", "air"];

interface Measure {
  label: string;
  value: (d: DiveSummary) => number | null;
  format: (v: number) => string;
}

// Min, average and max per measure, like Subsurface's statistics
const measures = (f: Format): Measure[] => [
  { label: "Max depth", value: (d) => d.max_depth_m, format: f.depth },
  { label: "Average depth", value: (d) => d.avg_depth_m, format: f.depth },
  { label: "Duration", value: (d) => d.duration_s, format: formatDuration },
  { label: "Coldest water", value: (d) => d.min_temp_k, format: (k) => f.temp(k) },
  { label: "Overall score", value: (d) => d.overall_score, format: (v) => String(Math.round(v)) },
  ...SKILLS.map((skill) => ({
    label: SKILL_NAMES[skill],
    value: (d: DiveSummary) => d.scores.find((s) => s.skill === skill)?.score ?? null,
    format: (v: number) => String(Math.round(v)),
  })),
];

function best(dives: DiveSummary[], value: (d: DiveSummary) => number | null, pick: "max" | "min") {
  let out: { dive: DiveSummary; value: number } | null = null;
  for (const d of dives) {
    const v = value(d);
    if (v !== null && (out === null || (pick === "max" ? v > out.value : v < out.value))) out = { dive: d, value: v };
  }
  return out;
}

export function LogStats({ dives }: { dives: DiveSummary[] }) {
  const f = useFormat();
  const records = [
    { label: "Deepest", ...best(dives, (d) => d.max_depth_m, "max"), format: f.depth },
    { label: "Longest", ...best(dives, (d) => d.duration_s, "max"), format: formatDuration },
    { label: "Coldest", ...best(dives, (d) => d.min_temp_k, "min"), format: (k: number) => f.temp(k) },
    { label: "Best overall score", ...best(dives, (d) => d.overall_score, "max"), format: formatScore },
  ];

  return (
    <div className="space-y-6">
      <section aria-label="Records" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {records.map((r) => (
          <div key={r.label} className="rounded-xl border border-surface-border bg-surface-raised/80 p-5">
            <p className="text-xs font-medium text-murk">{r.label}</p>
            {r.dive && r.value !== undefined ? (
              <>
                <p className="mt-2 text-2xl font-semibold text-foam">{r.format(r.value)}</p>
                <Link to={`/dives/${r.dive.id}`} className="mt-1 inline-block text-sm text-aqua hover:text-foam">
                  {formatDate(r.dive.started_at)}
                </Link>
              </>
            ) : (
              <p className="mt-2 text-2xl font-semibold text-foam">—</p>
            )}
          </div>
        ))}
      </section>

      <section className="overflow-x-auto rounded-xl border border-surface-border bg-surface-raised/80">
        <h2 className="border-b border-surface-border px-5 py-3 text-sm font-medium text-foam">
          Across {dives.length} dive{dives.length === 1 ? "" : "s"}
        </h2>
        <table className="w-full min-w-[480px] text-left text-sm tabular-nums">
          <thead className="text-xs text-murk">
            <tr>
              <th className="px-5 py-2 font-medium" />
              <th className="px-5 py-2 text-right font-medium">Lowest</th>
              <th className="px-5 py-2 text-right font-medium">Average</th>
              <th className="px-5 py-2 text-right font-medium">Highest</th>
              <th className="px-5 py-2 text-right font-medium">Dives</th>
            </tr>
          </thead>
          <tbody>
            {measures(f).map((m) => {
              const values = dives.map(m.value).filter((v): v is number => v !== null);
              const cell = (v: number | null) => (v === null ? "N/A" : m.format(v));
              return (
                <tr key={m.label} className="border-t border-surface-border/50">
                  <th scope="row" className="px-5 py-2 font-normal text-mist">{m.label}</th>
                  <td className="px-5 py-2 text-right text-foam">{cell(values.length ? Math.min(...values) : null)}</td>
                  <td className="px-5 py-2 text-right text-foam">
                    {cell(values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)}
                  </td>
                  <td className="px-5 py-2 text-right text-foam">{cell(values.length ? Math.max(...values) : null)}</td>
                  <td className="px-5 py-2 text-right text-murk">{values.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
