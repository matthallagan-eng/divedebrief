import type { Token, UploadResult, User } from "./types";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "divedebrief.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable: the session lasts until the page reloads
  }
}

// Set by AuthProvider so an expired session signs the diver out
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401 && getToken()) onUnauthorized();
    const detail = await res.json().catch(() => ({}));
    // FastAPI validation errors are a list; show the first, minus pydantic's prefix
    const message = Array.isArray(detail.detail)
      ? String(detail.detail[0]?.msg ?? "").replace(/^Value error, /, "")
      : detail.detail;
    throw new Error(message || `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  async login(email: string, password: string) {
    const body = new URLSearchParams({ username: email, password });
    const res = await fetch(`${BASE}/auth/login`, { method: "POST", body });
    return handle<Token>(res);
  },

  async register(email: string, password: string) {
    const res = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return handle<User>(res);
  },

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
    return handle<T>(res);
  },

  async upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/uploads`, { method: "POST", headers: authHeaders(), body: form });
    return handle<UploadResult>(res);
  },

  async putFile<T>(path: string, file: File): Promise<T> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}${path}`, { method: "PUT", headers: authHeaders(), body: form });
    return handle<T>(res);
  },

  async postFile<T>(path: string, file: File, fields: Record<string, string> = {}): Promise<T> {
    const form = new FormData();
    form.append("file", file);
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    const res = await fetch(`${BASE}${path}`, { method: "POST", headers: authHeaders(), body: form });
    return handle<T>(res);
  },

  /** A private file, such as a card photo, which an <img> can't fetch with the sign-in token. */
  async blob(path: string): Promise<Blob> {
    const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
    if (!res.ok) return handle<never>(res);
    return res.blob();
  },

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    return handle<T>(res);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return handle<T>(res);
  },

  async del<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, { method: "DELETE", headers: authHeaders() });
    return handle<T>(res);
  },
};
