# DiveDebrief V2 scope

V1 shows what happened on a dive. V2 rates how well it was dived: each dive
gets a skills scorecard, the logbook tracks those skills over time, and
other divers can sign up and use it.

Status: **agreed**. Decisions are at the end.

## In scope

1. Skills scorecard: ascent control, safety stop, buoyancy stability, air efficiency
2. Ascent habits over time
3. Direct FIT import
4. Dive sites and map
5. Accounts, per-diver data, hosting

## Out of scope (V3 or later)

- Logbook editing: notes, buddy, free-form dive fields. The two exceptions
  are the tank form for air efficiency and site names (feature 4).
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
  noise doesn't count (V1 used 14 s).
- Thresholds: target **≤ 9 m/min (30 ft/min)**, violation **> 18 m/min (60 ft/min)**.
- The final 6 m count more heavily than the rest of the ascent.
- Score = % of ascent time within target, minus penalties for violation segments.
- Reason example: "2 segments over 9 m/min, fastest 14 m/min between 8 m and 5 m."
- Defaults: final-6 m weight 2×; −10 points per violation segment, capped at −40.

### 1b. Safety stop

- Detected automatically: a continuous stretch in the **3–6 m** band
  (tolerance configurable) after the deepest point and before surfacing.
- Target: **3:00 at about 5 m (15 ft)**.
- Applies only to dives with max depth **≥ 10 m** (configurable). Shallower dives show N/A.
- Scored on time held vs. target, number of exits from the band, and depth
  drift within the stop.
- Reason example: "Held 2:10 of 3:00, drifted between 3.2 m and 6.1 m."
- Added while tuning on the real dives (milestone 2):
  - Time only counts as held while you're roughly still: under 3 m/min
    averaged over 30 s. That way, swimming steadily up through the band
    isn't a stop, but bobbing around the stop depth still is.
  - Time inside the tolerance counts as held. Drifting past the band edge for
    5 s or more costs points as a band exit.
  - Dips under 5 s are treated as sensor noise.

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
- Score from bands on both metrics.
- Reason example: "4 excursions over 1 m; steadiest stretch was minutes 12–20."
- Added while tuning on the real dives (milestone 3):
  - Surface intervals split the dive, and each stretch underwater gets its
    own bottom phase. Two of the real dives surface mid-dive.
  - The final ascent starts at the last plateau before the diver leaves for
    good, not where they cross 6 m. Otherwise the climb to the stop counts as
    an excursion. "Leaves for good" uses the stop band plus tolerance (6.5 m),
    because a stop that bobs to 6.4 m isn't the bottom.
  - Excursions must last 5 s, the same noise cutoff as the safety stop.
  - Score = up to 60 points for wobble (SD 0.25 m full, 1 m none) + up to 40
    for excursions, −10 per excursion per 10 minutes of bottom time.

### 1d. Air efficiency (SAC)

- SAC (L/min) = (pressure used in bar × tank volume in L) ÷ (minutes × average ambient pressure in ATA)
- ATA = depth_m / 10 + 1 in seawater; depth_m / 10.3 + 1 in fresh water, from the dive's site.
- Needs tank pressure samples (FIT with air integration), or start/end
  pressure and tank size entered by the diver in the tank form.
- Scored against the diver's own rolling baseline (last 5 dives with SAC),
  not an absolute good/bad number. The first dives score N/A with "Building
  your baseline (n of 5)".
- Reason example: "18.4 L/min, 9% better than your last 5 dives."
- Your Descent G2 has no tank transmitter, so your dives need manual entry.
- Added while building (milestone 5):
  - Average ATA comes from the dive's stored average depth (avg depth / k + 1),
    which is exact because ATA is linear in depth and both cover the same
    underwater time. So SAC needs no samples.
  - Baseline = median SAC of the previous 5 dives with tank data, by start time.
    Score = 75 at the baseline, ±1.5 points per % better or worse, clamped 0–100.
  - The air score is re-checked on every read, because a tank edit changes later
    dives' baselines. It's cheap: one query and no samples.
  - Water type comes from the dive (FIT) or a new default_water_type setting,
    until sites exist (milestone 6).
  - The tank form takes psi or bar and offers common US tanks (AL80 = 11.1 L).
    Sampled pressures are read-only; the diver adds only the tank size.

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
  versions within 0.2 m max depth, 60 s duration and the same fingerprint.

## 4. Dive sites and map

- Dives whose GPS positions fall within **200 m** of a site's centre join
  that site; otherwise they start a new one. A dive's position is its entry
  point, or its exit point when the watch had no fix going in.
- The diver can name a site and set its water type, which feeds the SAC
  calculation and future dives there. A site's water type overrides the FIT
  water setting; with neither, the default from settings applies.
- The home page is a globe of the diver's sites (MapLibre GL with
  OpenStreetMap tiles). Clicking a pin zooms to the site, which lists its
  dives and its average score per skill. Clicking a dive zooms in further and
  draws its entry and exit points. The watch has no GPS underwater, so the
  line between them is not the route.
- UDDF exports from Subsurface carry the site's position only, so those dives
  are placed on the map but have no separate entry and exit points.
- Dives without GPS go under "Unknown site".

## 5. Accounts, per-diver data, hosting

- Email and password sign-in with JWT, as in FloorSight.
- Uploads, dives, sites, settings and scores all belong to one diver.
  Dedupe fingerprints become unique per diver, not across the whole database.
- Existing V1 data is assigned to the first account created.
- Hosted on Railway. Uploads stay capped at 10 MB, with a per-diver
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

## Decisions

Settled 2026-10-21.

1. **Ascent window: 10 s.** The golden cases are re-derived for 10 s. The
   frontend copy of the ascent code (`frontend/src/lib/ascent.ts`) is retired,
   and the dive page shows backend results. The V1 "ascent limit" slider
   becomes the target threshold in settings.
2. **Tank data: small tank form in V2.** Tank size plus start and end
   pressure on the dive page. Other logbook editing waits for V3.
3. **Water type: per site.** Default salt; the FIT water-type field is used when present.
4. **Hosting: Railway.** Services for api and web, plus Railway Postgres.
5. **Scoring numbers: ship the proposed defaults.** Tune them against the real
   dives before the milestone 2 and 3 PRs, and explain them on a
   "How scores work" page.
6. **FIT test files:** the original `.fit` files for the three real dives go in
   `backend/tests/fixtures/fit/real/`.
7. **Map: a globe on the home page** (settled 2026-10-23), using MapLibre GL
   instead of Leaflet, since Leaflet can't draw a globe. The logbook moves to
   `/logbook`.
