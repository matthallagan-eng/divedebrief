import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Waves } from "lucide-react";
import Ocean from "../components/Ocean";
import { useAuth } from "../context/AuthContext";

const inputClass =
  "w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-foam outline-none transition-colors focus:border-lagoon";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const isLogin = mode === "login";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await (isLogin ? login : register)(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Ocean />
      <div className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-raised/80 p-8 backdrop-blur">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lagoon/15 text-aqua">
            <Waves size={20} />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-foam">DiveDebrief</h1>
            <p className="text-sm text-mist">
              {isLogin ? "Welcome back to the surface" : "Start your logbook"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-mist">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-mist">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              minLength={isLogin ? undefined : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            {!isLogin && <p className="mt-1 text-xs text-murk">At least 8 characters</p>}
          </div>

          {error && <p className="text-sm text-mist" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-lagoon px-4 py-2 text-sm font-medium text-abyss transition-colors hover:bg-aqua disabled:opacity-50"
          >
            {busy ? "Diving in…" : isLogin ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-murk">
          {isLogin ? "New here? " : "Already have an account? "}
          <Link to={isLogin ? "/register" : "/login"} className="text-aqua hover:text-foam">
            {isLogin ? "Create an account" : "Sign in"}
          </Link>
        </p>
      </div>
    </div>
  );
}
