import { CircleCheck, Crosshair, Info, ChartLine } from "lucide-react";
import type { ReactNode } from "react";
import type { Debrief as DebriefData, DebriefItem, Skill } from "../api/types";
import { formatDuration } from "../lib/format";
import { SKILL_NAMES } from "../lib/skills";

interface Props {
  debrief: DebriefData;
  onShow: (skill: Skill | null) => void; // open the profile with this skill's moments highlighted
}

// Each kind wears an icon and a label as well as a color, so it never rests on color alone
const KINDS: Record<DebriefItem["kind"], { label: string; icon: ReactNode; tone: string }> = {
  work_on: { label: "Work on", icon: <Crosshair size={14} />, tone: "text-coral" },
  good: { label: "Went well", icon: <CircleCheck size={14} />, tone: "text-seagrass" },
  info: { label: "Good to know", icon: <Info size={14} />, tone: "text-aqua" },
};
const ORDER: DebriefItem["kind"][] = ["work_on", "good", "info"];

/** The instructor-style debrief, written by fixed rules from the dive's scores and profile. */
export function Debrief({ debrief, onShow }: Props) {
  const { focus } = debrief;
  const rest = debrief.items.filter((i) => i !== focus && !(focus && same(i, focus)));
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-lagoon/40 bg-surface-raised/80 p-5">
        <p className="text-base font-medium text-foam">{debrief.headline}</p>
        {focus && (
          <div className="mt-4 rounded-lg border border-surface-border bg-surface/60 p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-coral">
              <Crosshair size={14} /> Focus for your next dive
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

function Item({ item, onShow }: { item: DebriefItem; onShow: Props["onShow"] }) {
  const showable = item.skill && item.skill !== "air" && item.at_s !== null;
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
          onClick={() => onShow(item.skill)}
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
