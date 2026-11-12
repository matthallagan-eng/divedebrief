import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import { api } from "../api/client";
import type { DivePhoto } from "../api/types";
import { useAchievements } from "../context/AchievementsContext";
import { usePrivateFile } from "../lib/privateFile";

const ACCEPT = "image/jpeg,image/png,image/webp";

const fieldClass =
  "w-full rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foam outline-none transition-colors focus:border-lagoon";

/** The dive's photos: a grid, opening one at a time full size with its caption. */
export function DivePhotos({ diveId }: { diveId: number }) {
  const { refresh } = useAchievements();
  const [photos, setPhotos] = useState<DivePhoto[] | null>(null);
  const [open, setOpen] = useState<number | null>(null); // index into photos
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<DivePhoto[]>(`/dives/${diveId}/photos`).then(setPhotos).catch((e) => setStatus(e.message));
  }, [diveId]);

  async function add(files: FileList) {
    setBusy(true);
    const added: DivePhoto[] = [];
    const failed: string[] = [];
    let i = 0;
    for (const file of Array.from(files)) {
      setStatus(`Uploading ${++i} of ${files.length}…`);
      try {
        added.push(await api.postFile<DivePhoto>(`/dives/${diveId}/photos`, file));
      } catch (e) {
        failed.push(`${file.name}: ${e instanceof Error ? e.message : "couldn't upload"}`);
      }
    }
    setPhotos((p) => [...(p ?? []), ...added]);
    setStatus(failed.length ? failed.join(". ") : null);
    setBusy(false);
    if (input.current) input.current.value = "";
    // The first photo unlocks a creature
    if (added.length) refresh();
  }

  function changed(photo: DivePhoto) {
    setPhotos((p) => p?.map((x) => (x.id === photo.id ? photo : x)) ?? null);
  }

  function removed(id: number) {
    const left = (photos ?? []).filter((x) => x.id !== id);
    setPhotos(left);
    setOpen((o) => (o === null || left.length === 0 ? null : Math.min(o, left.length - 1)));
  }

  return (
    <section className="rounded-xl border border-surface-border bg-surface-raised/80">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-3">
        <h2 className="text-sm font-medium text-foam">Photos</h2>
        <label className={`cursor-pointer rounded-lg bg-lagoon px-4 py-1.5 text-sm font-medium text-abyss transition-colors hover:bg-aqua ${busy ? "pointer-events-none opacity-50" : ""}`}>
          Add photos
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            multiple
            disabled={busy}
            onChange={(e) => e.target.files?.length && add(e.target.files)}
            className="sr-only"
          />
        </label>
      </div>
      <div className="px-5 py-4">
        {photos === null ? (
          !status && <p className="text-sm text-murk">Loading…</p>
        ) : photos.length === 0 ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-surface-border px-6 py-10 text-murk hover:text-mist"
          >
            <ImagePlus size={24} />
            <span className="text-sm">No photos from this dive yet</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpen(i)}
                className="group relative aspect-square overflow-hidden rounded-lg bg-surface"
              >
                <Thumb photo={p} />
                {p.caption && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-abyss/75 px-2 py-1 text-left text-xs text-mist">
                    {p.caption}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-murk">
          JPEG, PNG or WebP, up to 10 MB each and 30 per dive. Only you can see them.
          {status && <span className="ml-2 text-mist" role="status">{status}</span>}
        </p>
      </div>
      {open !== null && photos?.[open] && (
        <Viewer
          key={photos[open].id}
          photo={photos[open]}
          index={open}
          count={photos.length}
          onMove={(by) => setOpen((o) => (o === null ? o : (o + by + photos.length) % photos.length))}
          onClose={() => setOpen(null)}
          onChanged={changed}
          onRemoved={removed}
        />
      )}
    </section>
  );
}

function Thumb({ photo }: { photo: DivePhoto }) {
  const { url, failed } = usePrivateFile(`/photos/${photo.id}/file`);
  if (failed) return <span className="flex h-full items-center justify-center text-xs text-murk">Couldn't load</span>;
  if (!url) return null;
  return <img src={url} alt={photo.caption || "Dive photo"} className="h-full w-full object-cover transition-transform group-hover:scale-105" />;
}

interface ViewerProps {
  photo: DivePhoto;
  index: number;
  count: number;
  onMove: (by: number) => void;
  onClose: () => void;
  onChanged: (photo: DivePhoto) => void;
  onRemoved: (id: number) => void;
}

function Viewer({ photo, index, count, onMove, onClose, onChanged, onRemoved }: ViewerProps) {
  const { url } = usePrivateFile(`/photos/${photo.id}/file`);
  const [caption, setCaption] = useState(photo.caption);
  const [status, setStatus] = useState<string | null>(null);

  // Arrow keys step through, Escape closes, unless the caption is being typed
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft") onMove(-1);
      if (e.key === "ArrowRight") onMove(1);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onMove, onClose]);

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      onChanged(await api.put<DivePhoto>(`/photos/${photo.id}`, { caption }));
      setStatus("Saved.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't save the caption");
    }
  }

  async function remove() {
    if (!window.confirm("Delete this photo?")) return;
    try {
      await api.del(`/photos/${photo.id}`);
      onRemoved(photo.id);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't delete the photo");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Dive photo" className="fixed inset-0 z-50 flex flex-col bg-abyss/95 p-4" onClick={onClose}>
      <div className="flex items-center justify-between text-sm text-mist" onClick={(e) => e.stopPropagation()}>
        <span>{index + 1} of {count}</span>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-surface-raised hover:text-foam">
          <X size={20} />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center py-3">
        {url && (
          <img src={url} alt={photo.caption || "Dive photo"} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        )}
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => { e.stopPropagation(); onMove(-1); }}
              className="absolute left-0 rounded-full bg-surface-raised/80 p-2 text-mist hover:text-foam"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => { e.stopPropagation(); onMove(1); }}
              className="absolute right-0 rounded-full bg-surface-raised/80 p-2 text-mist hover:text-foam"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-3">
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={200}
          placeholder="Add a caption"
          aria-label="Caption"
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <button type="submit" className="rounded-lg bg-lagoon px-4 py-1.5 text-sm font-medium text-abyss transition-colors hover:bg-aqua">
          Save
        </button>
        <button type="button" onClick={remove} className="text-sm text-murk hover:text-coral">
          Delete
        </button>
        {status && <span className="w-full text-sm text-mist" role="status">{status}</span>}
      </form>
    </div>
  );
}
