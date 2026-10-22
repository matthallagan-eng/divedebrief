import type { UploadResult } from "./types";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`);
    return handle<T>(res);
  },

  async upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/uploads`, { method: "POST", body: form });
    return handle<UploadResult>(res);
  },

  async del<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
    return handle<T>(res);
  },
};
