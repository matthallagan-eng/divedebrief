import { ChartLine, CircleCheck, Crosshair, Flag, Info, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import type { Debrief as DebriefData, DebriefItem, Goal, Skill } from "../api/types";
import { formatDuration } from "../lib/format";
import { SKILL_NAMES } from "../lib/skills";

interface Props {
  debrief: DebriefData;
  onShow: (skill: Skill | null, at: number | null) => void; // open the profile at this moment
}

// Each kind wears an icon and a label as well as a color, so it never rests on color alone
const KINDS: Record<DebriefItem["kind"], { label: string; icon: ReactNode; tone: string }> = {
  work_on: { label: "Work on", icon: <Crosshair size={14} />, tone: "text-coral" },
  good: { label: "Went well", icon: <CircleCheck size={14} />, tone: "text-seagrass" },
  info: { label: "Good to know", icon: <Info size={14} />, tone: "text-aqua" },
};
const ORDER: DebriefItem["kind"][] = ["work_on", "good", "info"];

const GOAL_STATUS: Record<Goal["status"], { label: string; icon: ReactNode; tone: string }> = {
  met: { label: "Met", icon: <CircleCheck size={14} />, tone: "text-seagrass" },
  closer: { label: "Getting closer", icon: <TrendingUp size={14} />, tone: "text-aqua" },
  not_yet: { label: "Not yet", icon: <Crosshair size={14} />, tone: "text-coral" },
  not_scored: { label: "Not scored", icon: <Info size={14} />, tone: "text-murk" },
};

/** The instructor-style debrief, written by fixed rules from the dive's scores and profile. */
export function Debrief({ debrief, onShow }: Props) {
  const { focus } = debrief;
  const rest = debrief.items.filter((i) => i !== focus && !(focus && same(i, focus)));
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-lagoon/40 bg-surface-raised/80 p-5">
        {debrief.goal && <GoalCheck goal={debrief.goal} />}
        <p className="text-base font-medium text-foam">{debrief.headline}</p>
        {focus && (
          <div className="mt-4 rounded-lg border border-surface-border bg-surface/60 p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-coral">
              <Flag size={14} /> Goal for your next dive
            </p>
            <Item item={focus} onShow={onShow} />
          </div>
        )}
      </section>

      {ORDER.map((kind) => {
        const items = rest.filter((i) => i.kind === kind);
        if (!items.length) return null;
        const k = KINDS[kind];
        return (
          <section key={kind} className="rounded-xl border border-surface-border bg-surface-raised/80">
            <h2 className={`flex items-center gap-1.5 border-b border-surface-border px-5 py-3 text-sm font-medium ${k.tone}`}>
              {k.icon}
              <span className="text-foam">{k.label}</span>
            </h2>
            <ul className="divide-y divide-surface-border/60">
              {items.map((item) => (
                <li key={`${item.skill}-${item.title}`} className="px-5 py-4">
                  <Item item={item} onShow={onShow} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="text-xs text-murk">
        Written from your dive's numbers by fixed rules, not by an instructor. It's no substitute for one: ask
        yours about anything that worries you.
      </p>
    </div>
  );
}

function GoalCheck({ goal }: { goal: Goal }) {
  const s = GOAL_STATUS[goal.status];
  return (
    <div className="mb-4 border-b border-surface-border pb-4">
      <p className="text-xs uppercase tracking-wide text-murk">Your goal from last dive</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-foam">{goal.title}</span>
        <span className={`inline-flex items-center gap-1 text-sm ${s.tone}`}>
          {s.icon}
          {s.label}
        </span>
      </p>
      <p className="mt-1 text-sm text-mist">{goal.detail}</p>
    </div>
  );
}

function Item({ item, onShow }: { item: DebriefItem; onShow: Props["onShow"] }) {
  const showable = item.skill !== "air" && item.at_s !== null;
  return (
    <div className="mt-1 space-y-1">
      <p className="text-sm font-medium text-foam">
        {item.title}
        {item.skill && <span className="ml-2 text-xs font-normal text-murk">{SKILL_NAMES[item.skill]}</span>}
      </p>
      <p className="text-sm leading-relaxed text-mist">{item.detail}</p>
      {showable && (
        <button
          type="button"
          onClick={() => onShow(item.skill, item.at_s)}
          className="inline-flex items-center gap-1 text-xs text-aqua hover:text-foam"
        >
          <ChartLine size={12} />
          Show {formatDuration(item.at_s!)} on the profile
        </button>
      )}
    </div>
  );
}

function same(a: DebriefItem, b: DebriefItem) {
  return a.skill === b.skill && a.title === b.title;
}
