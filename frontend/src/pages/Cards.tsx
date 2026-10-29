import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { FileText, ImagePlus } from "lucide-react";
import { api } from "../api/client";
import type { CardInput, CardLevel, CardSide, CertCard } from "../api/types";
import { useAchievements } from "../context/AchievementsContext";
import { formatDate } from "../lib/format";
import { usePrivateFile } from "../lib/privateFile";

// Mirrors backend/app/certs.py. Agencies name courses differently, so each
// level says what it covers.
const LEVELS: { value: CardLevel; label: string; hint?: string }[] = [
  { value: "open_water", label: "Open Water", hint: "Your first full certification, to 18 m (60 ft)" },
  { value: "advanced", label: "Advanced Open Water", hint: "Also SSI Advanced Adventurer, NAUI Advanced Scuba Diver" },
  { value: "rescue", label: "Rescue Diver" },
  { value: "divemaster", label: "Divemaster", hint: "Also SSI Dive Guide" },
  { value: "instructor", label: "Instructor" },
  { value: "deep", label: "Deep Diver" },
  { value: "nitrox", label: "Enriched Air (Nitrox)" },
  { value: "other", label: "Another specialty" },
];
const AGENCIES = ["PADI", "SSI", "NAUI", "SDI", "RAID", "BSAC", "CMAS", "GUE"];
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

const fieldClass =
  "w-full rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foam outline-none transition-colors focus:border-lagoon";
const primary =
  "rounded-lg bg-lagoon px-4 py-1.5 text-sm font-medium text-abyss transition-colors hover:bg-aqua disabled:opacity-50";

export default function Cards() {
  const { refresh } = useAchievements();
  const [cards, setCards] = useState<CertCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The card being edited, or "new"
  const [editing, setEditing] = useState<number | "new" | null>(null);
  // Bumped after each save, so photos are fetched again
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api.get<CertCard[]>("/cards").then(setCards).catch((e) => setError(e.message));
  }, [version]);

  function saved() {
    setEditing(null);
    setVersion((v) => v + 1);
    // A new card can unlock creatures, which pop up straight away
    refresh();
  }

  async function remove(card: CertCard) {
    if (!window.confirm(`Delete your ${card.title || card.level_label} card and its photos?`)) return;
    try {
      await api.del(`/cards/${card.id}`);
      saved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the card");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foam">Certification cards</h1>
          <p className="mt-1 text-sm text-mist">
            Keep your cards to hand for the dive shop. Each level of training unlocks creatures in{" "}
            <Link to="/ocean" className="text-aqua hover:text-foam">My Ocean</Link>.
          </p>
        </div>
        {editing === null && (
          <button type="button" onClick={() => setEditing("new")} className={primary}>
            Add a card
          </button>
        )}
      </div>

      {error && <p className="text-sm text-coral" role="alert">{error}</p>}

      {editing === "new" && <CardForm onSaved={saved} onCancel={() => setEditing(null)} />}

      {cards === null ? (
        !error && <p className="text-sm text-murk">Loading…</p>
      ) : cards.length === 0 && editing !== "new" ? (
        <div className="rounded-xl border border-dashed border-surface-border bg-surface-raised/60 px-6 py-10 text-center">
          <p className="text-sm text-foam">No cards yet</p>
          <p className="mt-1 text-sm text-murk">Add your Open Water card to meet the scuba diver.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) =>
            editing === card.id ? (
              <div key={card.id} className="sm:col-span-2 lg:col-span-3">
                <CardForm card={card} onSaved={saved} onCancel={() => setEditing(null)} />
              </div>
            ) : (
              <CardTile key={card.id} card={card} version={version} onEdit={() => setEditing(card.id)} onDelete={() => remove(card)} />
            ),
          )}
        </div>
      )}

      <p className="text-xs text-murk">
        Only you can see your cards. Photos can be JPEG, PNG, WebP or PDF, up to 10 MB.
      </p>
    </div>
  );
}

function CardTile({ card, version, onEdit, onDelete }: { card: CertCard; version: number; onEdit: () => void; onDelete: () => void }) {
  const [side, setSide] = useState<CardSide>("front");
  const media = card[side];
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised/80">
      {/* A real card's proportions */}
      <div className="relative aspect-[85.6/54] bg-surface">
        {media ? (
          <Photo key={`${side}-${version}`} cardId={card.id} side={side} media={media} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-murk">
            <ImagePlus size={22} />
            <button type="button" onClick={onEdit} className="text-xs text-aqua hover:text-foam">
              Add a photo of the {side}
            </button>
          </div>
        )}
        {(card.front || card.back) && (
          <div className="absolute bottom-2 right-2 flex overflow-hidden rounded-md border border-surface-border bg-abyss/80 text-xs">
            {(["front", "back"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                aria-pressed={side === s}
                className={`px-2 py-0.5 capitalize ${side === s ? "bg-lagoon/30 text-foam" : "text-mist hover:text-foam"}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col px-4 py-3">
        <p className="text-sm font-medium text-foam">{card.title || card.level_label}</p>
        {card.title && <p className="text-xs text-mist">{card.level_label}</p>}
        <dl className="mt-2 space-y-0.5 text-xs text-murk">
          {card.agency && <div><dt className="inline">Agency: </dt><dd className="inline text-mist">{card.agency}</dd></div>}
          {card.certified_on && <div><dt className="inline">Certified: </dt><dd className="inline text-mist">{formatDate(card.certified_on)}</dd></div>}
          {card.number && <div><dt className="inline">Number: </dt><dd className="inline tabular-nums text-mist">{card.number}</dd></div>}
        </dl>
        <div className="mt-auto flex gap-4 pt-3 text-sm">
          <button type="button" onClick={onEdit} className="text-aqua hover:text-foam">Edit</button>
          <button type="button" onClick={onDelete} className="text-murk hover:text-coral">Delete</button>
        </div>
      </div>
    </div>
  );
}

/** A card photo, or a link to the PDF. */
function Photo({ cardId, side, media }: { cardId: number; side: CardSide; media: string }) {
  const { url, failed } = usePrivateFile(`/cards/${cardId}/${side}`);
  if (failed) return <p className="flex h-full items-center justify-center text-xs text-murk">Couldn't load the photo</p>;
  if (!url) return null;
  if (media === "application/pdf") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="flex h-full flex-col items-center justify-center gap-1 text-mist hover:text-foam">
        <FileText size={26} />
        <span className="text-xs">Open the PDF</span>
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Open full size">
      <img src={url} alt={`The ${side} of the card`} className="h-full w-full object-contain" />
    </a>
  );
}

function CardForm({ card, onSaved, onCancel }: { card?: CertCard; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<CardInput>({
    agency: card?.agency ?? "",
    level: card?.level ?? "open_water",
    title: card?.title ?? "",
    number: card?.number ?? "",
    certified_on: card?.certified_on ?? null,
  });
  const [files, setFiles] = useState<Partial<Record<CardSide, File>>>({});
  const [drop, setDrop] = useState<Partial<Record<CardSide, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // Set once a new card is saved, so retrying after a failed photo doesn't add it twice
  const [id, setId] = useState(card?.id);
  const set = <K extends keyof CardInput>(key: K, value: CardInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const hint = LEVELS.find((l) => l.value === form.level)?.hint;
  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const saved = id ? await api.put<CertCard>(`/cards/${id}`, form) : await api.post<CertCard>("/cards", form);
      setId(saved.id);
      for (const side of ["front", "back"] as const) {
        const file = files[side];
        if (file) await api.putFile(`/cards/${saved.id}/${side}`, file);
        else if (drop[side]) await api.del(`/cards/${saved.id}/${side}`);
      }
      onSaved();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't save the card");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-surface-border bg-surface-raised/80">
      <h2 className="border-b border-surface-border px-5 py-3 text-sm font-medium text-foam">
        {card ? "Edit card" : "Add a card"}
      </h2>
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-murk">
          <span className="block">Level</span>
          <select value={form.level} onChange={(e) => set("level", e.target.value as CardLevel)} className={fieldClass}>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          {hint && <span className="block">{hint}</span>}
        </label>
        <label className="space-y-1 text-xs text-murk">
          <span className="block">Course name on the card{form.level === "other" ? "" : " (optional)"}</span>
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={80}
            required={form.level === "other"}
            placeholder={form.level === "other" ? "Wreck Diver" : "As printed, if it differs"}
            className={fieldClass}
          />
        </label>
        <label className="space-y-1 text-xs text-murk">
          <span className="block">Agency</span>
          <input value={form.agency} onChange={(e) => set("agency", e.target.value)} maxLength={40} list="agencies" className={fieldClass} />
          <datalist id="agencies">
            {AGENCIES.map((a) => <option key={a} value={a} />)}
          </datalist>
        </label>
        <label className="space-y-1 text-xs text-murk">
          <span className="block">Certification date</span>
          <input
            type="date"
            max={today}
            value={form.certified_on ?? ""}
            onChange={(e) => set("certified_on", e.target.value || null)}
            className={fieldClass}
          />
        </label>
        <label className="space-y-1 text-xs text-murk">
          <span className="block">Diver or card number</span>
          <input value={form.number} onChange={(e) => set("number", e.target.value)} maxLength={40} className={fieldClass} />
        </label>
        <div className="hidden sm:block" />
        {(["front", "back"] as const).map((side) => (
          <div key={side} className="space-y-1 text-xs text-murk">
            <label htmlFor={`photo-${side}`} className="block capitalize">{side} photo</label>
            <input
              id={`photo-${side}`}
              type="file"
              accept={ACCEPT}
              onChange={(e) => {
                const file = e.target.files?.[0];
                setFiles((f) => ({ ...f, [side]: file }));
                setDrop((d) => ({ ...d, [side]: false }));
              }}
              className="block w-full text-sm text-mist file:mr-3 file:rounded-lg file:border-0 file:bg-lagoon/15 file:px-3 file:py-1.5 file:text-sm file:text-aqua hover:file:bg-lagoon/25"
            />
            {card?.[side] && !files[side] && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!drop[side]} onChange={(e) => setDrop((d) => ({ ...d, [side]: e.target.checked }))} />
                Remove the current photo
              </label>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-surface-border px-5 py-3">
        <button type="submit" disabled={busy} className={primary}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="text-sm text-aqua hover:text-foam">
          Cancel
        </button>
        {status && <span className="text-sm text-coral" role="alert">{status}</span>}
      </div>
    </form>
  );
}
