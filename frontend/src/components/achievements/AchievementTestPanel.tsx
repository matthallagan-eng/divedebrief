// TEMPORARY: a panel for trying out achievements without earning them. It
// shows only when the API runs with ACHIEVEMENT_TEST_MODE=true. To remove
// test mode, delete this file, its use in MyOcean, the TEMPORARY parts of
// AchievementsContext, and Settings.achievement_test_mode in the API.

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { useAchievements } from "../../context/AchievementsContext";
import { TIER_LABEL } from "../creatures/registry";

export function AchievementTestPanel() {
  const { data, previewAll, setPreviewAll, preview, replayReveals } = useAchievements();
  const all = data?.achievements ?? [];
  const [key, setKey] = useState(all[0]?.key ?? "");
  const [busy, setBusy] = useState(false);
  const chosen = all.find((a) => a.key === key);
  const button =
    "rounded-lg border border-coral/40 px-3 py-1.5 text-sm text-foam transition-colors hover:border-coral disabled:opacity-50";

  return (
    <div className="rounded-xl border border-dashed border-coral/50 bg-coral/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-coral">
        <FlaskConical size={16} />
        Test mode (temporary)
      </p>
      <p className="mt-1 text-xs text-mist">
        Try reveals and creatures without earning them. Previews don't change what you've earned.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={key}
          onChange={(e) => setKey(e.target.value)}
          aria-label="Creature to preview"
          className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foam outline-none focus:border-lagoon"
        >
          {all.map((a) => (
            <option key={a.key} value={a.key}>
              {TIER_LABEL[a.tier]}: {a.secret ? "The Kraken (secret)" : a.name}
            </option>
          ))}
        </select>
        <button
          className={button}
          disabled={!chosen}
          // The secret one is previewed under its real name
          onClick={() => chosen && preview({ kind: "one", creature: chosen.secret ? { ...chosen, name: "The Kraken", goal: "Earn every other creature." } : chosen })}
        >
          Preview reveal
        </button>
        <button className={button} onClick={() => preview({ kind: "many", creatures: all.filter((a) => a.tier !== "legendary").slice(0, 10) })}>
          Preview first-time reveal
        </button>
        <label className="flex items-center gap-2 text-sm text-mist">
          <input type="checkbox" checked={previewAll} onChange={(e) => setPreviewAll(e.target.checked)} />
          Show every creature (collection and background)
        </label>
        <button
          className={button}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            replayReveals().finally(() => setBusy(false));
          }}
        >
          Replay my real unlocks
        </button>
      </div>
    </div>
  );
}
