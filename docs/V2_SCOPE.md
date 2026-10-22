# DiveDebrief V2 scope

V1 shows what happened on a dive. V2 rates how well it was dived: each dive
gets a skills scorecard, the logbook tracks those skills over time, and
other divers can sign up and use it.

Status: **draft** — open questions are at the end and need answers before
the milestone they block.

## In scope

1. Skills scorecard: ascent control, safety stop, buoyancy stability, air efficiency
2. Ascent habits over time
3. Direct FIT import
4. Dive sites and map
5. Accounts, per-diver data, hosting

## Out of scope (V3 or later)

- Logbook editing: notes, buddy, free-form dive fields. The two exceptions
  are tank data for air efficiency (Q2) and site names (feature 4).
- Sharing dives between divers, instructors reviewing students
- Gas-switch, rebreather, or decompression-dive analysis
- Native mobile app

---

## 1. Skills scorecard

Each dive gets four skill scores (0–100), each with a short, specific reason
string. A skill that can't be computed shows **N/A with the reason** (for
example "No tank pressure data"), never a made-up score.

All thresholds below are per-diver settings with these defaults. Scores are
computed on the backend, stored with the version of the algorithm, and
recomputed when a diver changes a setting or the algorithm changes.

### 1a. Ascent control

- Ascent rate from depth samples, smoothed over a **10 s** window so sample
  noise doesn't count (V1 uses 14 s, see Q1).
- Thresholds: target **≤ 9 m/min (30 ft/min)**, violation **> 18 m/min (60 ft/min)**.
- The final 6 m count more heavily than the rest of the ascent.
- Score = % of ascent time within target, minus penalties for violation segments.
- Reason example: "2 segments over 9 m/min, fastest 14 m/min between 8 m and 5 m."
- Proposed defaults (Q5): final-6 m weight 2×; −10 points per violation segment, capped at −40.

### 1b. Safety stop

- Detected automatically: a continuous stretch in the **3–6 m** band
  (tolerance configurable) after the deepest point and before surfacing.
- Target: **3:00 at about 5 m (15 ft)**.
- Applies only to dives with max depth **≥ 10 m** (configurable). Shallower dives show N/A.
- Scored on time held vs. target, number of exits from the band, and depth
  drift within the stop.
- Reason example: "Held 2:10 of 3:00, drifted between 3.2 m and 6.1 m."

### 1c. Buoyancy stability

- **Bottom phase:** from the end of the descent to the start of the final
  ascent. The detection rule gets written up in the README. Proposed rule:
  - Descent ends at the first point within 1 m of the first local depth
    plateau, where the 30 s rate stays under 3 m/min.
  - The final ascent starts at the last time the diver left that bottom
    phase without coming back below 6 m.
- Detrend depth with a rolling median (default **60 s**), so deliberate depth
  changes along a reef don't count as instability.
- Metrics: standard deviation of the detrended depth, and the count of
  unintended vertical excursions **> 1 m**.
- Score from bands on both metrics (Q5).
- Reason example: "4 excursions over 1 m; steadiest stretch was minutes 12–20."

### 1d. Air efficiency (SAC)

- SAC (L/min) = (pressure used in bar × tank volume in L) ÷ (minutes × average ambient pressure in ATA)
- ATA = depth_m / 10 + 1 in seawater; depth_m / 10.3 + 1 in fresh water (Q3).
- Needs tank pressure samples (FIT with air integration), or start/end
  pressure and tank size entered by the diver (Q2).
- Scored against the diver's own rolling baseline (last 5 dives with SAC),
  not an absolute good/bad number. The first dives score N/A with "Building
  your baseline (n of 5)".
- Reason example: "18.4 L/min, 9% better than your last 5 dives."
- Your Descent Mk1 exports have no tank pressure, so your dives need manual entry.

### 1e. Scorecard UI

- Four cards on the dive page, above the profile chart.
- Clicking a card highlights its region on the profile: ascent segments,
  stop window, or bottom phase.
- Optional overall dive score = weighted average of the skills that have a
  score, leaving out N/A ones. Weights are configurable, equal by default.
- Settings page for thresholds, weights, units (m/ft, bar/psi) and default water type.

## 2. Ascent habits over time

- Logbook page with a chart of each skill score per dive over time.
- An ascent-rate trend: median and fastest ascent rate per dive.
- Headline numbers: last 10 dives vs. the 10 before, for each skill.
- Filterable by site (feature 4).

## 3. Direct FIT import

- Upload `.fit` files from Garmin Descent watches alongside UDDF. The same
  dedupe fingerprint applies, so a dive imported both ways is stored once.
- Parse with the official Garmin FIT SDK for Python (`garmin-fit-sdk`).
- Store the extra channels when they're present: heart rate, tank pressure
  (air-integrated models), NDL, water type and the GPS start point.
- **Done when:** your three dives, uploaded as `.fit`, match the stored UDDF
  versions within 0.2 m max depth, 60 s duration and the same fingerprint (Q6).

## 4. Dive sites and map

- Dives whose GPS start points fall within **200 m** of each other group into one site.
- The diver can name a site and set its water type, which feeds the SAC
  calculation and future dives there.
- Map of sites (Leaflet with OpenStreetMap tiles). Each site lists its dives
  and its average score per skill.
- Dives without GPS go under "Unknown site".

## 5. Accounts, per-diver data, hosting

- Email and password sign-in with JWT, as in FloorSight.
- Uploads, dives, sites, settings and scores all belong to one diver.
  Dedupe fingerprints become unique per diver, not across the whole database.
- Existing V1 data is assigned to the first account created.
- Hosted deployment (Q4). Uploads stay capped at 10 MB, with a per-diver
  rate limit on uploads.

---

## Data model changes (summary)

- `users`, plus `user_id` on `uploads`, `dives`, `sites` and `settings`
- `sites` (id, user_id, name, centroid lat/lon, water type); `dives.site_id`
- `samples` gain nullable `heart_rate`, `tank_pressure_bar`, `ndl_s`
- `dive_tanks` (dive_id, volume_l, start_bar, end_bar, source: sampled | manual)
- `dive_scores` (dive_id, skill, score or null, reason, algorithm_version, computed_at, plus the highlight region as JSON)
- `user_settings` (thresholds, weights, units, default water type)

## Milestones

The order follows the dependencies. Each milestone ends with tests and its own PR.

1. **Accounts and per-diver data.** Every other table needs `user_id`, so this comes first and avoids migrating twice.
2. **Scoring engine, ascent control and safety stop.** Scorecard UI with region highlighting.
3. **Buoyancy stability.** Write up the bottom-phase rule and test it on your three real dives.
4. **FIT import.**
5. **Air efficiency.** Tank data entry, baseline scoring.
6. **Sites and map.**
7. **Ascent habits over time.**
8. **Hosting.**

## Testing approach

- Each skill gets hand-derived synthetic profiles with known scores, the
  same way `shared/ascent-golden.json` works in V1.
- Your three real dives get expected scores you agree look right, checked
  in as fixtures.
- FIT and UDDF versions of the same dive must produce the same stored dive.

---

## Open questions

**Q1. Ascent window and the V1 ascent code.** The V2 spec uses a 10 s window;
V1 uses 14 s. Recommendation:
- Switch to 10 s and re-derive the golden cases.
- Retire the frontend copy of the ascent code (`frontend/src/lib/ascent.ts`)
  and have the dive page show backend results. With four skills, keeping two
  implementations in sync stops being worth it.
- The V1 "ascent limit" slider becomes the target threshold in settings.

**Q2. Tank data entry.** Logbook editing is deferred, but without air
integration SAC can only come from manual entry. Recommendation: include just
a tank form (size, start and end pressure) on the dive page in V2.

**Q3. Fresh or salt water.** Your dives' GPS points are inland in northwest
Ohio, so they're probably fresh water. Water type changes the ATA used in SAC.
It also matters whether the watch's depth reading was calibrated for fresh or
salt water. Recommendation: water type per site, default salt, with the FIT
water-type field used when it's present.

**Q4. Hosting.** Where should it run? Candidates: Fly.io, Render, Railway, a
VPS with docker-compose. The app needs Postgres and space for uploads.

**Q5. Score bands and penalties.** The spec leaves the exact values open for
ascent penalties, safety-stop scoring and the buoyancy bands. Recommendation:
- Ship the proposed defaults.
- Tune them against your real dives before the milestone 2 and 3 PRs.
- Show the scoring rules on a "How scores work" page.

**Q6. FIT test files.** For the FIT import check, please add the original
`.fit` files for your three dives to `backend/tests/fixtures/fit/real/`.
