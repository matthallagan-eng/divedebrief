import { Link } from "react-router-dom";
import type { Skill, SkillScoreDetail } from "../api/types";
import { SKILL_NAMES, formatScore } from "../lib/skills";

interface Props {
  scores: SkillScoreDetail[];
  overall: number | null;
  selected: Skill | null;
  onSelect: (skill: Skill | null) => void;
}

export function Scorecard({ scores, overall, selected, onSelect }: Props) {
  return (
    <section aria-label="Skill scores" className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium text-foam">Skills</h2>
        <Link to="/scores" className="text-xs text-aqua hover:text-foam">How scores work</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        <div className="rounded-xl border border-surface-border bg-surface-raised/80 p-5">
          <p className="text-xs font-medium text-murk">Overall</p>
          <p className="mt-2 text-4xl font-semibold text-foam">{formatScore(overall)}</p>
          <p className="mt-2 text-sm text-mist">
            {overall === null ? "No skills could be scored on this dive." : "Weighted average of the scored skills."}
          </p>
        </div>
        {scores.map((s) => {
          const active = selected === s.skill;
          return (
            <button
              key={s.skill}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? null : s.skill)}
              className={`rounded-xl border p-5 text-left transition-colors ${
                active
                  ? "border-lagoon bg-lagoon/10"
                  : "border-surface-border bg-surface-raised/80 hover:border-lagoon/50"
              }`}
            >
              <p className="text-xs font-medium text-murk">{SKILL_NAMES[s.skill]}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-foam">{formatScore(s.score)}</span>
                {s.score !== null && <span className="text-sm text-murk">/ 100</span>}
              </div>
              {s.score !== null && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-lagoon/15">
                  <div className="h-full rounded-full bg-lagoon" style={{ width: `${s.score}%` }} />
                </div>
              )}
              <p className="mt-3 text-sm text-mist">{s.reason}</p>
              {s.regions.length > 0 && (
                <p className="mt-2 text-xs text-aqua">
                  {active ? "Shown on the profile" : "Show on the profile"}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
