# DiveDebrief

Upload UDDF dive logs and review depth profiles with ascent-rate violations highlighted.

Garmin Descent users: import your dives into Subsurface, then use File → Export → UDDF.

## Local development

```sh
docker compose up -d db
cd backend
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
cp .env.example .env
.venv/Scripts/alembic upgrade head
.venv/Scripts/uvicorn app.main:app --reload
```
