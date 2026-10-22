import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Anchor, Trash2, Upload as UploadIcon } from "lucide-react";
import { api } from "../api/client";
import type { UploadOut, UploadResult } from "../api/types";
import { formatLocalDateTime } from "../lib/format";

const ACCEPTED = [".fit", ".uddf", ".xml"];

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadOut[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    api.get<UploadOut[]>("/uploads").then(setUploads).catch(() => {});
  }

  useEffect(refresh, []);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!ACCEPTED.some((ext) => f.name.toLowerCase().endsWith(ext))) {
      setError("That doesn't look like a dive log. Upload a Garmin .fit file or a UDDF export.");
      return;
    }
    setError(null);
    setResult(null);
    setFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.upload(file));
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(u: UploadOut) {
    if (!confirm(`Delete ${u.filename} and its ${u.dives_added} dive(s)?`)) return;
    await api.del(`/uploads/${u.id}`);
    refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foam">Log dives</h1>
        <p className="mt-1 text-sm text-mist">
          Garmin Descent: upload the .fit file from Garmin Connect (Export Original) or straight off the
          watch. UDDF exports from Subsurface work too. Dives already in your logbook are skipped, whichever
          format they came from.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
          dragging
            ? "border-aqua bg-lagoon/10"
            : "border-surface-border bg-surface-raised/60 hover:border-lagoon/60"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          onChange={(e) => pick(e.target.files?.[0])}
          className="hidden"
        />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lagoon/10 text-aqua">
          <UploadIcon size={24} />
        </div>
        <p className="mt-4 text-sm text-foam">
          {file ? file.name : "Drop a .fit file or UDDF export here, or click to choose one"}
        </p>
        <p className="mt-1 text-xs text-murk">.fit, .uddf or .xml, up to 10 MB</p>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleUpload}
          disabled={!file || busy}
          className="rounded-lg bg-lagoon px-4 py-2 text-sm font-medium text-abyss transition-colors hover:bg-aqua disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Diving in…" : "Upload"}
        </button>
        {error && <p className="text-sm text-mist">{error}</p>}
      </div>

      {result && (
        <div className="rounded-xl border border-surface-border bg-surface-raised/80 p-5">
          <p className="flex items-center gap-2 text-sm text-foam">
            <Anchor size={16} className="text-aqua" />
            {summarize(result)}
            {result.skipped > 0 && result.added + result.updated > 0 && (
              <span className="text-mist">· {result.skipped} already logged</span>
            )}
          </p>
          {result.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-mist">
              {result.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
          {result.added + result.updated > 0 && (
            <Link to="/" className="mt-3 inline-block text-sm text-aqua hover:text-foam">
              View logbook →
            </Link>
          )}
        </div>
      )}

      {uploads.length > 0 && (
        <section className="overflow-x-auto rounded-xl border border-surface-border bg-surface-raised/80">
          <h2 className="border-b border-surface-border px-5 py-3 text-sm font-medium text-foam">Past uploads</h2>
          <table className="w-full min-w-[520px] text-left text-sm tabular-nums">
            <thead className="text-xs text-murk">
              <tr>
                <th className="px-5 py-2 font-medium">File</th>
                <th className="px-5 py-2 font-medium">Uploaded</th>
                <th className="px-5 py-2 text-right font-medium">Dives</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {uploads.map((u) => (
                <tr key={u.id} className="border-t border-surface-border/50">
                  <td className="px-5 py-2 text-foam">{u.filename}</td>
                  <td className="px-5 py-2 text-mist">{formatLocalDateTime(u.uploaded_at)}</td>
                  <td className="px-5 py-2 text-right text-mist">{u.dives_added}</td>
                  <td className="px-5 py-2 text-right">
                    <button
                      onClick={() => handleDelete(u)}
                      aria-label={`Delete ${u.filename}`}
                      className="rounded p-1 text-murk transition-colors hover:text-foam"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function plural(n: number) {
  return `${n} dive${n === 1 ? "" : "s"}`;
}

function summarize(r: UploadResult) {
  const parts = [];
  if (r.added > 0) parts.push(`${plural(r.added)} added to your logbook`);
  if (r.updated > 0) parts.push(`${plural(r.updated)} filled in with heart rate, GPS and water type from the watch`);
  return parts.length ? parts.join(", ") : "No new dives. Everything in this file was already logged";
}
