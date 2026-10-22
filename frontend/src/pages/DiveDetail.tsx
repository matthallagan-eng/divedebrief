import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDownToLine, ChevronLeft, Gauge, Thermometer, Timer, Trash2 } from "lucide-react";
import { api } from "../api/client";
import type { DiveDetail as Dive } from "../api/types";
import { AscentBadge } from "../components/AscentBadge";
import { DiveCharts } from "../components/DiveCharts";
import { StatCard } from "../components/StatCard";
import { DEFAULT_LIMIT_M_PER_MIN, violationSegments } from "../lib/ascent";
import { formatDate, formatDepth, formatDuration, formatTemp, formatTime } from "../lib/format";

const LIMIT_KEY = "divedebrief.ascentLimit";

function loadLimit(): number {
  try {
    const v = Number(localStorage.getItem(LIMIT_KEY));
    return v >= 3 && v <= 18 ? v : DEFAULT_LIMIT_M_PER_MIN;
  } catch {
    return DEFAULT_LIMIT_M_PER_MIN;
  }
}

export default function DiveDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dive, setDive] = useState<Dive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(loadLimit);

  useEffect(() => {
    api.get<Dive>(`/dives/${id}`).then(setDive).catch((e: Error) => setError(e.message));
  }, [id]);

  function changeLimit(v: number) {
    setLimit(v);
    try {
      localStorage.setItem(LIMIT_KEY, String(v));
    } catch {
      // per-viewer convenience only
    }
  }

  const segments = useMemo(
    () =>
      dive
        ? violationSegments(dive.samples.map((s) => s.t_s), dive.samples.map((s) => s.depth_m), limit)
        : [],
    [dive, limit],
  );

  async function handleDelete() {
    if (!dive || !confirm("Delete this dive from your logbook?")) return;
    await api.del(`/dives/${dive.id}`);
    navigate("/");
  }

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-mist">{error}</p>
      </div>
    );
  }
  if (!dive) return <p className="text-sm text-murk">Descending…</p>;

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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={<ArrowDownToLine size={14} />} label="Max depth" value={formatDepth(dive.max_depth_m)} />
        <StatCard icon={<Gauge size={14} />} label="Average depth" value={formatDepth(dive.avg_depth_m)} />
        <StatCard icon={<Timer size={14} />} label="Duration" value={formatDuration(dive.duration_s)} />
        <StatCard icon={<Thermometer size={14} />} label="Coldest water" value={formatTemp(dive.min_temp_k)} />
        <StatCard label="Fast ascents" value={String(segments.length)} sub={<AscentBadge count={segments.length} />} />
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-surface-border bg-surface-raised/60 px-5 py-3">
        <label htmlFor="limit" className="text-sm text-mist">Ascent limit</label>
        <input
          id="limit"
          type="range"
          min={3}
          max={18}
          step={0.5}
          value={limit}
          onChange={(e) => changeLimit(Number(e.target.value))}
          className="w-48"
        />
        <span className="font-mono text-sm text-foam">{limit} m/min</span>
        {limit !== DEFAULT_LIMIT_M_PER_MIN && (
          <button onClick={() => changeLimit(DEFAULT_LIMIT_M_PER_MIN)} className="text-sm text-aqua hover:text-foam">
            Reset to {DEFAULT_LIMIT_M_PER_MIN}
          </button>
        )}
      </div>

      <DiveCharts samples={dive.samples} segments={segments} limit={limit} />

      <ViolationTable segments={segments} limit={limit} />

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
    <Link to="/" className="inline-flex items-center gap-1 text-sm text-murk hover:text-mist">
      <ChevronLeft size={14} />
      Logbook
    </Link>
  );
}

function ViolationTable({ segments, limit }: { segments: ReturnType<typeof violationSegments>; limit: number }) {
  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised/80">
      <h2 className="border-b border-surface-border px-5 py-3 text-sm font-medium text-foam">
        Ascents faster than {limit} m/min
      </h2>
      {segments.length === 0 ? (
        <p className="px-5 py-4 text-sm text-mist">None. A slow, controlled ascent all the way up.</p>
      ) : (
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-xs text-murk">
            <tr>
              <th className="px-5 py-2 font-medium">From</th>
              <th className="px-5 py-2 font-medium">To</th>
              <th className="px-5 py-2 text-right font-medium">Lasted</th>
              <th className="px-5 py-2 text-right font-medium">Peak rate</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => (
              <tr key={s.start_s} className="border-t border-surface-border/50">
                <td className="px-5 py-2 font-mono text-mist">{formatDuration(s.start_s)}</td>
                <td className="px-5 py-2 font-mono text-mist">{formatDuration(s.end_s)}</td>
                <td className="px-5 py-2 text-right text-mist">{Math.round(s.end_s - s.start_s)} s</td>
                <td className="px-5 py-2 text-right text-foam">{s.peak_rate_m_per_min.toFixed(1)} m/min</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
