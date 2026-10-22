# DiveDebrief

Upload UDDF dive logs and review depth profiles with ascent-rate violations highlighted.

Garmin Descent users: import your dives into Subsurface, then use File → Export → UDDF.

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
cd frontend && npm test
```

Ascent-rate detection is implemented twice, in `backend/app/analysis/ascent.py`
(for the stored violation count) and `frontend/src/lib/ascent.ts` (for the
adjustable limit on the dive page). Both run against the hand-derived cases in
`shared/ascent-golden.json`, so change the two implementations together.
