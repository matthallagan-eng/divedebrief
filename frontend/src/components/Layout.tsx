import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { Waves } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Ocean from "./Ocean";

const nav = [
  { to: "/", label: "Logbook" },
  { to: "/upload", label: "Log dives" },
  { to: "/settings", label: "Settings" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
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
          <nav className="flex w-full items-center justify-between gap-4 whitespace-nowrap sm:w-auto sm:justify-end sm:gap-5">
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
            <button
              onClick={handleLogout}
              title={user?.email}
              className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-murk transition-colors hover:border-lagoon/60 hover:text-mist"
            >
              Sign out
            </button>
          </nav>
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
  );
}
