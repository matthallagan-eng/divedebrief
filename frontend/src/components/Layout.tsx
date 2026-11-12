import { NavLink, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Waves } from "lucide-react";
import { AchievementsProvider } from "../context/AchievementsContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import type { SettingsResponse } from "../api/types";
import { setUnits } from "../lib/units";
import Ocean from "./Ocean";

const nav = [
  { to: "/", label: "Map" },
  { to: "/logbook", label: "Logbook" },
  { to: "/upload", label: "Log dives" },
  { to: "/ocean", label: "My Ocean" },
  { to: "/cards", label: "Cards" },
  { to: "/settings", label: "Settings" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Units are saved with the diver's settings; the cached copy may be from another account or device
  useEffect(() => {
    api.get<SettingsResponse>("/settings").then((s) => setUnits(s.values.units)).catch(() => {});
  }, [user?.id]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <AchievementsProvider>
      <div className="min-h-screen">
        <Ocean />
        <header className="relative bg-surface-raised/70 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
            <NavLink to="/" className="flex items-center gap-2 text-foam">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lagoon/15 text-aqua">
                <Waves size={18} />
              </span>
              <span className="text-sm font-semibold tracking-tight">DiveDebrief</span>
            </NavLink>
            {/* On phones the links take their own row under the logo and Sign out, tightly spaced, wrapping on the narrowest */}
            <nav className="order-last flex w-full flex-wrap items-center justify-between gap-x-1.5 gap-y-1 whitespace-nowrap sm:order-none sm:ml-auto sm:w-auto sm:justify-end sm:gap-5">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    isActive
                      ? "text-sm text-foam"
                      : "text-sm text-murk transition-colors hover:text-mist"
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button
              onClick={handleLogout}
              title={user?.email}
              className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-murk transition-colors hover:border-lagoon/60 hover:text-mist"
            >
              Sign out
            </button>
          </div>
          {/* Wave edge where the header meets the water */}
          <svg
            aria-hidden
            viewBox="0 0 1440 24"
            preserveAspectRatio="none"
            className="absolute inset-x-0 top-full h-3 w-full text-surface-raised/70"
          >
            <path
              fill="currentColor"
              d="M0 0h1440v8c-120 10-240 14-360 8S840 0 720 4 480 20 360 18 120 6 0 10z"
            />
          </svg>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </AchievementsProvider>
  );
}
