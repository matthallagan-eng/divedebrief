import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { ScoringSettings, SettingsResponse } from "../api/types";

// Constants mirror backend/app/scoring/ascent_control.py and safety_stop.py

export default function HowScoresWork() {
  const [s, setS] = useState<ScoringSettings | null>(null);

  useEffect(() => {
    api.get<SettingsResponse>("/settings").then((r) => setS(r.values)).catch(() => {});
  }, []);

  if (!s) return <p className="text-sm text-murk">Descending…</p>;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foam">How scores work</h1>
        <p className="mt-1 text-sm text-mist">
          Each skill is scored 0–100 with the reason written next to it. When a skill can't be
          scored, it shows N/A and says why. It never shows a made-up number. The numbers below are
          your current <Link to="/settings" className="text-aqua hover:text-foam">settings</Link>.
        </p>
      </div>

      <Section title="Ascent control">
        <p>
          Ascent rate is smoothed over {s.ascent_window_s} s so sensor noise doesn't count. Every second
          you're rising faster than 3 m/min below the surface counts as ascent time.
        </p>
        <ul>
          <li>
            The base score is the share of ascent time at or under your{" "}
            <b>{s.ascent_target_m_per_min} m/min</b> target.
          </li>
          <li>
            Ascent in the last <b>{s.ascent_final_zone_m} m</b> counts {s.ascent_final_zone_weight}×,
            because that's where pressure changes fastest.
          </li>
          <li>
            Each stretch over <b>{s.ascent_violation_m_per_min} m/min</b> lasting 3 s or more costs
            10 points, up to 40.
          </li>
        </ul>
        <p>Dives with under 10 s of ascent show N/A.</p>
      </Section>

      <Section title="Safety stop">
        <p>
          Applies to dives deeper than <b>{s.stop_min_dive_depth_m} m</b>. After your deepest point,
          DiveDebrief looks for time spent between <b>{s.stop_band_min_m} and {s.stop_band_max_m} m</b>{" "}
          while holding roughly still: moving less than 3 m/min averaged over 30 s. Swimming steadily
          up through the band isn't a stop. Drifting up to {s.stop_tolerance_m} m outside the band
          doesn't end it.
        </p>
        <ul>
          <li>
            Up to 70 points for time held, full marks at <b>{Math.floor(s.stop_target_s / 60)}:
            {String(s.stop_target_s % 60).padStart(2, "0")}</b>.
          </li>
          <li>
            Up to 30 points for stability: −5 for each time you leave the band for 5 s or more (up to 3),
            and −5 per metre of drift beyond 1.5 m (up to −15).
          </li>
          <li>Less than 30 s held counts as a skipped stop and scores 0.</li>
        </ul>
      </Section>

      <Section title="Overall">
        <p>
          The weighted average of the skills that have a score, with ascent control weighted{" "}
          {s.weight_ascent}× and the safety stop {s.weight_stop}×. N/A skills are left out, not
          counted as zero.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-surface-border bg-surface-raised/80 p-5 text-sm leading-relaxed text-mist [&_b]:font-medium [&_b]:text-foam [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
      <h2 className="text-base font-medium text-foam">{title}</h2>
      {children}
    </section>
  );
}
