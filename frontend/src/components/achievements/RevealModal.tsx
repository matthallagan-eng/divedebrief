import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { Achievement } from "../../api/types";
import { CreatureFigure } from "../creatures/CreatureFigure";
import { TIER_COLOR, TIER_LABEL } from "../creatures/registry";

export type Reveal =
  | { kind: "one"; creature: Achievement; test?: boolean }
  | { kind: "many"; creatures: Achievement[]; test?: boolean };

/** The moment a creature is unlocked: its silhouette swims in and lights up. */
export function RevealModal({ reveal, onClose }: { reveal: Reveal; onClose: () => void }) {
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    button.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reveal-title"
      className="reveal-fade fixed inset-0 z-50 flex items-center justify-center bg-abyss/85 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-surface-border bg-surface-raised p-6 text-center shadow-2xl sm:p-8">
        {reveal.test && (
          <p className="absolute left-3 top-3 rounded bg-coral/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-coral">
            Test preview
          </p>
        )}
        {reveal.kind === "one" ? <One creature={reveal.creature} test={reveal.test} /> : <Many creatures={reveal.creatures} />}
        <button
          ref={button}
          onClick={onClose}
          className="reveal-late mt-6 rounded-lg bg-lagoon px-5 py-2 text-sm font-medium text-abyss transition-colors hover:bg-aqua"
        >
          {reveal.kind === "one" ? "Add to My Ocean" : "Dive in"}
        </button>
      </div>
    </div>
  );
}

function One({ creature, test }: { creature: Achievement; test?: boolean }) {
  const legendary = creature.tier === "legendary";
  return (
    <>
      <p className="reveal-late text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: TIER_COLOR[creature.tier] }}>
        {TIER_LABEL[creature.tier]} unlocked
      </p>
      <div className="relative my-6 flex h-40 items-center justify-center">
        {legendary && <div className="reveal-glow absolute inset-0 m-auto h-40 w-40 rounded-full" />}
        <div className="reveal-swim">
          <div className={`reveal-light ${legendary ? "reveal-legend" : ""}`}>
            <CreatureFigure creature={creature.key} height={130} maxWidth={360} />
          </div>
        </div>
      </div>
      <h2 id="reveal-title" className="reveal-late text-2xl font-semibold text-foam">
        {creature.name}
      </h2>
      <p className="reveal-late mt-2 text-sm text-mist">
        {creature.goal}
        {creature.earned_dive_id !== null && !test && (
          <>
            {" "}
            <Link to={`/dives/${creature.earned_dive_id}`} className="text-aqua hover:text-foam">
              See the dive
            </Link>
          </>
        )}
      </p>
      <p className="reveal-late mt-1 text-xs text-murk">It'll swim through your background from now on.</p>
    </>
  );
}

function Many({ creatures }: { creatures: Achievement[] }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aqua">Your ocean</p>
      <h2 id="reveal-title" className="mt-2 text-2xl font-semibold text-foam">
        Your ocean is filling up
      </h2>
      <p className="mt-2 text-sm text-mist">
        You've already unlocked {creatures.length} creatures. They'll swim through your background from now on; earn
        more to bring rarer ones.
      </p>
      <div className="mt-6 grid max-h-[50vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
        {creatures.map((c, i) => (
          <div key={c.key} className="reveal-pop flex flex-col items-center gap-1.5" style={{ animationDelay: `${0.3 + i * 0.15}s` }}>
            <div className="flex h-16 items-center">
              <CreatureFigure creature={c.key} height={52} maxWidth={96} />
            </div>
            <span className="text-xs text-foam">{c.name}</span>
            <span className="text-[10px] uppercase tracking-wide" style={{ color: TIER_COLOR[c.tier] }}>
              {TIER_LABEL[c.tier]}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
