import { useEffect, useId, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { api } from "../api/client";
import type { Notes, NotesInput, NoteTags } from "../api/types";
import { formatLocalDateTime } from "../lib/format";

const FEELINGS = ["Rough", "Uneasy", "OK", "Good", "Great"]; // feeling 1-5

// Mirrors NOTE_TAG_MAX and NOTE_TAGS_MAX in backend/app/schemas.py
const TAG_MAX = 60;
const TAGS_MAX = 40;

interface Props {
  diveId: number;
  notes: Notes | null;
  onSaved: () => void;
}

const empty: NotesInput = { feeling: null, sea_life: [], landmarks: [], text: "" };

export function DiveNotes({ diveId, notes, onSaved }: Props) {
  // The page remounts this on each save (see DiveDetail), so the draft starts from what was stored
  const saved: NotesInput = notes ?? empty;
  const [draft, setDraft] = useState<NotesInput>(() => pick(saved));
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
          placeholder="Visibility, conditions, buddy, gear, anything you want to remember…"
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
  return { feeling: n.feeling, sea_life: n.sea_life, landmarks: n.landmarks, text: n.text };
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
