import { useEffect, useId, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { api } from "../api/client";
import type { Notes, NotesInput, NoteTags, Thermocline } from "../api/types";
import { formatLocalDateTime } from "../lib/format";
import { useFormat } from "../lib/units";

const FEELINGS = ["Rough", "Uneasy", "OK", "Good", "Great"]; // feeling 1-5

// Mirrors NOTE_TAG_MAX and NOTE_TAGS_MAX in backend/app/schemas.py
const TAG_MAX = 60;
const TAGS_MAX = 40;

interface Props {
  diveId: number;
  notes: Notes | null;
  thermocline: Thermocline | null; // detected from the watch's temperatures
  onSaved: () => void;
}

const empty: NotesInput = { feeling: null, sea_life: [], landmarks: [], text: "", visibility_m: null, buddy: null };

export function DiveNotes({ diveId, notes, thermocline, onSaved }: Props) {
  const f = useFormat();
  // The page remounts this on each save (see DiveDetail), so the draft starts from what was stored
  const saved: NotesInput = notes ?? empty;
  const [draft, setDraft] = useState<NotesInput>(() => pick(saved));
  // Visibility is stored in metres; the box shows the diver's units
  const [visibility, setVisibility] = useState(
    saved.visibility_m === null ? "" : String(+f.toDepth(saved.visibility_m).toFixed(1)),
  );
  const [known, setKnown] = useState<NoteTags>({ sea_life: [], landmarks: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(pick(saved));

  useEffect(() => {
    // Things noted on earlier dives, offered as you type
    api.get<NoteTags>("/dives/note-tags").then(setKnown).catch(() => {});
  }, []);

  const update = (change: Partial<NotesInput>) => setDraft((d) => ({ ...d, ...change }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.put(`/dives/${diveId}/notes`, draft);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-surface-border bg-surface-raised/80 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-foam">Dive notes</h2>
        {notes && <p className="text-xs text-murk">Saved {formatLocalDateTime(notes.updated_at)}</p>}
      </div>

      <fieldset>
        <legend className="text-xs text-murk">How did you feel?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {FEELINGS.map((label, i) => {
            const value = i + 1;
            const active = draft.feeling === value;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => update({ feeling: active ? null : value })}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-lagoon bg-lagoon/15 text-foam"
                    : "border-surface-border text-mist hover:border-lagoon/50 hover:text-foam"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs text-murk">Conditions</legend>
        <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="space-y-1 text-xs text-murk">
            <span className="block">Visibility ({f.depthUnit})</span>
            <input
              type="number" min={0} max={f.toDepth(100)} step="any"
              value={visibility}
              onChange={(e) => {
                setVisibility(e.target.value);
                const v = e.target.value === "" ? null : Math.round(f.fromDepth(Number(e.target.value)) * 10) / 10;
                update({ visibility_m: v });
              }}
              className="w-24 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-right text-sm text-foam outline-none transition-colors focus:border-lagoon"
            />
          </label>
          <label className="space-y-1 text-xs text-murk">
            <span className="block">Buddy</span>
            <input
              type="text" maxLength={80} placeholder="Who you dived with"
              value={draft.buddy ?? ""}
              onChange={(e) => update({ buddy: e.target.value || null })}
              className="w-56 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foam outline-none transition-colors placeholder:text-murk focus:border-lagoon"
            />
          </label>
          <div className="space-y-1 text-xs text-murk">
            <span className="block">Thermocline</span>
            <p className="py-1.5 text-sm text-mist">
              {thermocline
                ? `${f.depth(thermocline.top_m)}–${f.depth(thermocline.bottom_m)}: ${f.temp(thermocline.above_k)} → ${f.temp(thermocline.below_k)}`
                : "None found"}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-murk">The thermocline is found from your watch's temperatures; you don't enter it.</p>
      </fieldset>

      <div className="grid gap-5 md:grid-cols-2">
        <TagInput
          label="Sea life"
          placeholder="e.g. Bluegill, turtle…"
          tags={draft.sea_life}
          known={known.sea_life}
          onChange={(sea_life) => update({ sea_life })}
        />
        <TagInput
          label="Landmarks"
          placeholder="e.g. Sunken bus, mooring line…"
          tags={draft.landmarks}
          known={known.landmarks}
          onChange={(landmarks) => update({ landmarks })}
        />
      </div>

      <label className="block">
        <span className="text-xs text-murk">Notes</span>
        <textarea
          value={draft.text}
          maxLength={5000}
          rows={4}
          placeholder="Current, surface conditions, anything you want to remember…"
          onChange={(e) => update({ text: e.target.value })}
          className="mt-1 w-full resize-y rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-foam outline-none transition-colors placeholder:text-murk focus:border-lagoon"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || saving}
          className="rounded-lg bg-lagoon px-4 py-1.5 text-sm font-medium text-abyss transition-colors hover:bg-aqua disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save notes"}
        </button>
        {error && <span className="text-xs text-coral">{error}</span>}
      </div>
    </form>
  );
}

function pick(n: NotesInput): NotesInput {
  return {
    feeling: n.feeling, sea_life: n.sea_life, landmarks: n.landmarks, text: n.text,
    visibility_m: n.visibility_m, buddy: n.buddy,
  };
}

interface TagInputProps {
  label: string;
  placeholder: string;
  tags: string[];
  known: string[];
  onChange: (tags: string[]) => void;
}

/** Chips plus a text box; Enter or a comma adds what's typed. */
function TagInput({ label, placeholder, tags, known, onChange }: TagInputProps) {
  const [text, setText] = useState("");
  const listId = useId();
  const has = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());

  function add(raw: string) {
    const tag = raw.replace(/\s+/g, " ").trim().slice(0, TAG_MAX);
    if (tag && !has(tag) && tags.length < TAGS_MAX) onChange([...tags, tag]);
    setText("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div>
      <label htmlFor={listId + "-input"} className="text-xs text-murk">
        {label}
      </label>
      <div className="mt-1 flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-2 py-1.5 transition-colors focus-within:border-lagoon">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-lagoon/15 py-0.5 pr-1 pl-2 text-sm text-foam">
            {t}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="rounded text-murk hover:text-foam"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          id={listId + "-input"}
          list={listId}
          value={text}
          maxLength={TAG_MAX}
          placeholder={tags.length ? "" : placeholder}
          onChange={(e) => {
            // Picking from the list fills the box with a known entry: add it straight away
            if (known.includes(e.target.value)) add(e.target.value);
            else setText(e.target.value);
          }}
          onKeyDown={handleKey}
          onBlur={() => add(text)}
          className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm text-foam outline-none placeholder:text-murk"
        />
        <datalist id={listId}>
          {known.filter((k) => !has(k)).map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
      </div>
      <p className="mt-1 text-xs text-murk">Press Enter or comma to add</p>
    </div>
  );
}
