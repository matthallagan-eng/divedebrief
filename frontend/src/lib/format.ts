export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function formatDepth(m: number): string {
  return `${m.toFixed(1)} m`;
}

export function formatTemp(k: number | null): string {
  return k === null ? "—" : `${(k - 273.15).toFixed(0)} °C`;
}

export function formatTempRange(lowK: number, highK: number): string {
  const [lo, hi] = [lowK, highK].map((k) => (k - 273.15).toFixed(0));
  return lo === hi ? `${lo} °C` : `${lo}–${hi} °C`;
}

// Dive start times are wall-clock times tagged as UTC by the parser, so they
// are formatted in UTC to show the time the dive computer recorded.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
}

// Upload timestamps are real instants, shown in the viewer's timezone
export function formatLocalDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
