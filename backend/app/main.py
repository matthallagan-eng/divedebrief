from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import auth, dives, sites, uploads
from .routers import settings as settings_router

app = FastAPI(
    title="DiveDebrief API",
    description="Scuba dive log analysis",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["ops"])
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(uploads.router)
app.include_router(dives.router)
app.include_router(sites.router)
app.include_router(settings_router.router)
