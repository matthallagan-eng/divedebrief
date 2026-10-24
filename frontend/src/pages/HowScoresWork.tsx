import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { ScoringSettings, SettingsResponse } from "../api/types";

// Constants mirror backend/app/scoring/ascent_control.py, safety_stop.py, buoyancy.py and air.py

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

      <Section title="Buoyancy">
        <p>
          Judged on the bottom phase only: from the end of your descent to the start of your final
          ascent. Each time underwater between surface intervals gets its own bottom phase, so a
          surface swim mid-dive doesn't count against you.
        </p>
        <ul>
          <li>
            The descent ends where you first level off: 30 s moving less than 3 m/min. The final ascent
            starts where you last levelled off before leaving for the stop, the last time deeper than{" "}
            <b>{+(s.stop_band_max_m + s.stop_tolerance_m).toFixed(1)} m</b>. The safety stop is scored separately.
          </li>
          <li>
            Your level at each moment is the median depth over <b>{s.buoyancy_detrend_window_s} s</b>,
            so following the reef up or down doesn't count as instability.
          </li>
          <li>
            Up to 60 points for how closely you hold your level: full marks for a typical wobble of
            0.25 m or less, none at 1 m.
          </li>
          <li>
            Up to 40 points for excursions: rising or sinking more than{" "}
            <b>{s.buoyancy_excursion_m} m</b> off your level for 5 s or more. Each one costs 10 points
            per 10 minutes of bottom time.
          </li>
        </ul>
        <p>Dives with less than 3 minutes of settled bottom time show N/A.</p>
      </Section>

      <Section title="Air efficiency">
        <p>
          Based on your surface air consumption (SAC): how many litres of air a minute you'd breathe at
          the surface. It's worked out from the pressure you used, your tank size, your time underwater
          and your average depth. Tank pressure comes from your dive computer if it has a transmitter;
          otherwise enter it on the dive page.
        </p>
        <ul>
          <li>
            Depth is turned into pressure for the dive's water type: 10 m per atmosphere in salt water,
            10.3 m in fresh. Dives whose file doesn't say use your default, <b>{s.default_water_type}</b>.
          </li>
          <li>
            Each dive is compared with the median SAC of your previous 5 dives that have one. Matching
            it scores 75, and each 1% better or worse moves the score 1.5 points, so about 17% better
            is 100.
          </li>
          <li>Until 5 earlier dives have tank data, the score shows N/A while your baseline builds.</li>
        </ul>
      </Section>

      <Section title="Overall">
        <p>
          The weighted average of the skills that have a score, with ascent control weighted{" "}
          {s.weight_ascent}×, the safety stop {s.weight_stop}×, buoyancy {s.weight_buoyancy}× and air
          efficiency {s.weight_air}×. N/A skills are left out, not counted as zero.
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
