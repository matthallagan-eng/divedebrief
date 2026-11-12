import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import type { Achievement, Achievements } from "../api/types";
import { RevealModal, type Reveal } from "../components/achievements/RevealModal";

interface Ctx {
  data: Achievements | null;
  // Creatures in the background ocean: earned ones, or all of them in a test-mode preview
  unlocked: Achievement[];
  refresh: () => void;
  // TEMPORARY test mode (see AchievementTestPanel)
  previewAll: boolean;
  setPreviewAll: (on: boolean) => void;
  preview: (reveal: Reveal) => void;
  replayReveals: () => Promise<void>;
}

const AchievementsCtx = createContext<Ctx | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAchievements(): Ctx {
  const ctx = useContext(AchievementsCtx);
  if (!ctx) throw new Error("useAchievements outside AchievementsProvider");
  return ctx;
}

const NONE: Achievement[] = [];

/** Unlocked creatures for the background; none on pages outside the provider, like sign-in. */
// eslint-disable-next-line react-refresh/only-export-components
export function useUnlockedCreatures(): Achievement[] {
  return useContext(AchievementsCtx)?.unlocked ?? NONE;
}

/** Fetches achievements on every page change, so new ones are revealed soon
 * after the upload, note or gear change that earned them. */
export function AchievementsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [data, setData] = useState<Achievements | null>(null);
  const [queue, setQueue] = useState<Reveal[]>([]);
  const [previewAll, setPreviewAll] = useState(false);
  // Reveals already queued this session, so a refetch doesn't queue them twice
  const queued = useRef(new Set<string>());

  const refresh = useCallback(() => {
    api
      .get<Achievements>("/achievements")
      .then((next) => {
        setData(next);
        const fresh = next.achievements.filter((a) => a.earned_at && !a.seen && !queued.current.has(a.key));
        if (fresh.length === 0) return;
        fresh.forEach((a) => queued.current.add(a.key));
        // The first time, everything already earned is revealed together; after that, one at a time
        const reveals: Reveal[] =
          next.first_reveal && fresh.length > 1
            ? [{ kind: "many", creatures: fresh }]
            : fresh.map((a) => ({ kind: "one", creature: a }));
        setQueue((q) => [...q, ...reveals]);
      })
      .catch(() => {});
  }, []);

  useEffect(refresh, [refresh, location.pathname]);

  const close = () => {
    const [shown, ...rest] = queue;
    setQueue(rest);
    if (shown?.test) return;
    const keys = shown?.kind === "one" ? [shown.creature.key] : (shown?.creatures.map((c) => c.key) ?? []);
    if (keys.length) api.post("/achievements/seen", { keys }).catch(() => {});
  };

  const value = useMemo<Ctx>(() => {
    const all = data?.achievements ?? [];
    return {
      data,
      unlocked: previewAll ? all : all.filter((a) => a.earned_at),
      refresh,
      previewAll,
      setPreviewAll,
      preview: (reveal) => setQueue((q) => [...q, { ...reveal, test: true }]),
      // Forgets which reveals were seen, so the real ones play again
      replayReveals: async () => {
        await api.post("/achievements/test/reset-seen");
        queued.current.clear();
        refresh();
      },
    };
  }, [data, previewAll, refresh]);

  return (
    <AchievementsCtx.Provider value={value}>
      {children}
      {queue[0] && (
        <RevealModal
          key={queue[0].kind === "one" ? queue[0].creature.key : `many-${queue[0].creatures.length}`}
          reveal={queue[0]}
          onClose={close}
        />
      )}
    </AchievementsCtx.Provider>
  );
}
