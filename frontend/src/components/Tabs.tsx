import { useId, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export interface Tab<K extends string> {
  key: K;
  label: string;
  badge?: string; // e.g. a count, shown muted after the label
}

interface Props<K extends string> {
  tabs: Tab<K>[];
  active: K;
  onChange: (key: K) => void;
  label: string; // names the tab list for screen readers
  children: ReactNode; // the active tab's panel
}

/** WAI-ARIA tabs: arrow keys, Home and End move between tabs. */
export function Tabs<K extends string>({ tabs, active, onChange, label, children }: Props<K>) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKey(e: KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].key);
    refs.current[next]?.focus();
  }

  return (
    <div>
      {/* The rule is an inset shadow, not a border the tabs overlap with -mb-px: that overlap made
          the strip taller than its box, so Windows drew scroll arrows. Scrolls sideways on phones. */}
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-surface-border)] [scrollbar-width:none]"
      >
        {tabs.map((t, i) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`${id}-tab-${t.key}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.key)}
              onKeyDown={(e) => handleKey(e, i)}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-sm transition-colors ${
                selected ? "border-lagoon text-foam" : "border-transparent text-murk hover:text-mist"
              }`}
            >
              {t.label}
              {t.badge && <span className="ml-1.5 text-xs text-murk">{t.badge}</span>}
            </button>
          );
        })}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} className="pt-6">
        {children}
      </div>
    </div>
  );
}
