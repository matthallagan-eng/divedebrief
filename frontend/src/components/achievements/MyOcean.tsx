import { Link } from "react-router-dom";
import type { Achievement, Tier } from "../../api/types";
import { useAchievements } from "../../context/AchievementsContext";
import { formatDate } from "../../lib/format";
import { CreatureFigure } from "../creatures/CreatureFigure";
import { TIER_COLOR, TIER_LABEL } from "../creatures/registry";
import { AchievementTestPanel } from "./AchievementTestPanel";

const TIERS: Tier[] = ["common", "uncommon", "rare", "epic", "legendary"];

const TIER_BLURB: Record<Tier, string> = {
  common: "First steps",
  uncommon: "Building skills",
  rare: "A committed diver",
  epic: "A seasoned diver",
  legendary: "Years of diving",
};

/** The creature collection: what's swimming in your ocean, and what's still out there. */
export function MyOcean() {
  const { data, previewAll } = useAchievements();
  if (!data) return <p className="text-sm text-murk">Counting fish…</p>;
  const all = data.achievements;
  const earned = all.filter((a) => a.earned_at).length;

  return (
    <div className="space-y-8">
      {data.test_mode && <AchievementTestPanel />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold text-foam">
            {earned} <span className="text-base font-normal text-murk">of {all.length} creatures unlocked</span>
          </p>
          <p className="mt-1 text-sm text-mist">
            Each achievement brings a new creature into your background. The rarer the creature, the more it takes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIERS.map((t) => {
            const tier = all.filter((a) => a.tier === t);
            return (
              <span key={t} className="rounded-full border border-surface-border px-2.5 py-1 text-xs" style={{ color: TIER_COLOR[t] }}>
                {TIER_LABEL[t]} {tier.filter((a) => a.earned_at).length}/{tier.length}
              </span>
            );
          })}
        </div>
      </div>

      {TIERS.map((t) => (
        <section key={t}>
          <h3 className="flex items-baseline gap-2 text-sm font-semibold" style={{ color: TIER_COLOR[t] }}>
            {TIER_LABEL[t]}
            <span className="text-xs font-normal text-murk">{TIER_BLURB[t]}</span>
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {all
              .filter((a) => a.tier === t)
              .map((a) => (
                <Card key={a.key} a={a} show={previewAll || a.earned_at !== null} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Card({ a, show }: { a: Achievement; show: boolean }) {
  const earned = a.earned_at !== null;
  const hidden = a.secret && !show;
  return (
    <div
      className={`flex flex-col rounded-xl border p-4 ${
        earned ? "border-surface-border bg-surface-raised/80" : "border-surface-border/60 bg-surface/50"
      }`}
    >
      <div className="flex h-20 items-center justify-center">
        {hidden ? (
          <span className="text-3xl font-semibold text-surface-border">?</span>
        ) : (
          <CreatureFigure creature={a.key} height={64} maxWidth={150} locked={!show} />
        )}
      </div>
      <p className={`mt-3 text-sm font-medium ${show ? "text-foam" : "text-mist"}`}>{a.name}</p>
      <p className="mt-0.5 text-xs text-murk">{a.goal}</p>
      <div className="mt-auto pt-3 text-xs">
        {earned ? (
          a.earned_dive_id !== null ? (
            <Link to={`/dives/${a.earned_dive_id}`} className="text-aqua hover:text-foam">
              Unlocked {formatDate(a.earned_at!)}
            </Link>
          ) : (
            <span className="text-aqua">Unlocked</span>
          )
        ) : a.coming_soon ? (
          <span className="rounded bg-lagoon/10 px-1.5 py-0.5 text-mist">Coming with {a.coming_soon}</span>
        ) : a.target > 1 ? (
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-border/60">
              <div className="h-full rounded-full bg-lagoon" style={{ width: `${Math.min(100, (100 * a.progress) / a.target)}%` }} />
            </div>
            <p className="mt-1 text-murk">
              {a.progress} of {a.target}
            </p>
          </div>
        ) : (
          <span className="text-murk">Not yet</span>
        )}
      </div>
    </div>
  );
}
