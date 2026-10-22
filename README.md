# DiveDebrief

Upload dive logs and review depth profiles with skill scores for each dive.

Accepts Garmin `.fit` files (Garmin Connect → Export Original, or straight off
the watch) and UDDF exports (for example Subsurface → File → Export → UDDF).
FIT files also bring heart rate, NDL, tank pressure on air-integrated models,
water type and GPS position.

A dive is identified by its start time, so the same dive uploaded as FIT and
as UDDF is stored once.

## Run everything with Docker

```sh
docker compose up --build
```

Web app at http://localhost:3000, API at http://localhost:8000.

## Local development

Backend:

```sh
docker compose up -d db
cd backend
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
cp .env.example .env   # then set SECRET_KEY (the command is in the file)
.venv/Scripts/alembic upgrade head
.venv/Scripts/uvicorn app.main:app --reload
```

Frontend (http://localhost:5173):

```sh
cd frontend
npm install
npm run dev
```

## Accounts

Each diver signs up with an email and password and only sees their own
uploads and dives. The first account created also takes over any dives
uploaded before accounts existed (V1 data).

## Tests

```sh
cd backend && .venv/Scripts/python -m pytest   # API tests need the db container running
cd frontend && npm run lint && npm run build
```

## Scoring

Skill scores are computed on the backend (`backend/app/scoring/`), stored
per dive, and recomputed when a diver changes their settings or
`ALGORITHM_VERSION` is bumped. Each skill module's docstring states its
rules, and `tests/test_scoring.py` checks hand-derived scores for synthetic
profiles. `tests/test_real_scores.py` pins the scores of the three real dives.
Bump `ALGORITHM_VERSION` whenever a change could alter a score.

### Bottom phase (buoyancy)

Buoyancy is judged only on the bottom phase, found like this:

1. The dive is split at surface intervals (0.75 m or shallower). Each stretch
   underwater of a minute or more gets its own bottom phase.
2. A plateau is 30 s or more where the depth rate, averaged over 30 s, stays
   under 3 m/min either way.
3. The descent ends at the first point within 1 m of the first plateau's depth.
4. The diver leaves for good at the last moment deeper than the safety stop
   band plus its tolerance (6.5 m by default). The final ascent starts at the
   last point within 1 m of the last plateau before that. Stretches that never
   go that deep use their last plateau. This keeps the climb to the stop and
   the stop itself out of the buoyancy score.
5. Bottom phases under a minute are dropped; under 3 minutes in total is N/A.
