import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Lock } from "lucide-react";
import { api } from "../api/client";
import type { Milestone } from "../api/types";
import { formatDate } from "../lib/format";

/** Badges across the whole logbook: earned ones link to the dive, the rest show progress. */
export function Milestones() {
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Milestone[]>("/milestones").then(setMilestones).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-mist">{error}</p>;
  if (!milestones) return <p className="text-sm text-murk">Counting bubbles…</p>;
  const earned = milestones.filter((m) => m.earned_dive_id !== null).length;

  return (
    <section aria-label="Milestones" className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-foam">
          Milestones <span className="font-normal text-murk">{earned} of {milestones.length}</span>
        </h2>
        <p className="text-xs text-murk">
          Across your whole logbook. Score milestones follow your current settings and difficulty.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {milestones.map((m) => {
          const done = m.earned_dive_id !== null;
          const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
          return (
            <li
              key={m.key}
              className={`rounded-xl border p-4 ${
                done ? "border-lagoon/50 bg-lagoon/10" : "border-surface-border bg-surface-raised/80"
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-medium text-foam">
                <span className={done ? "text-aqua" : "text-murk"} aria-hidden="true">
                  {done ? <Award size={16} /> : <Lock size={14} />}
                </span>
                {m.title}
                <span className="sr-only">{done ? "earned" : "not yet earned"}</span>
              </p>
              <p className="mt-1 text-xs text-mist">{m.description}</p>
              {done ? (
                <Link to={`/dives/${m.earned_dive_id}`} className="mt-2 inline-block text-xs text-aqua hover:text-foam">
                  Earned {formatDate(m.earned_at!)}
                </Link>
              ) : m.target > 1 ? (
                <div className="mt-3">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-surface-border"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={m.target}
                    aria-valuenow={m.progress}
                    aria-label={`${m.title} progress`}
                  >
                    <div className="h-full rounded-full bg-lagoon" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-murk">
                    {m.progress} of {m.target}
                    {m.key.startsWith("hours") ? " min" : ""}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-murk">Not yet</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
