from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://divedebrief:divedebrief@localhost:5432/divedebrief"
    cors_origins: str = "http://localhost:5173"
    # Required, no default: a missing or weak key must stop the app starting
    secret_key: str
    access_token_expire_minutes: int = 60 * 24 * 7
    max_upload_bytes: int = 10 * 1024 * 1024
    # Certification card photos. In Docker this is a volume (docker-compose.yml).
    upload_dir: str = "data/uploads"
    # Public OpenStreetMap services for site name suggestions (app.places).
    # Overpass servers are tried in order; they're often busy.
    overpass_urls: str = (
        "https://overpass-api.de/api/interpreter,"
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
    )
    nominatim_url: str = "https://nominatim.openstreetmap.org/reverse"
    # TEMPORARY: lets the diver preview achievement reveals and creatures
    # without earning them (app.routers.achievements, AchievementTestPanel).
    # Remove with them once achievements are tuned.
    achievement_test_mode: bool = False

    class Config:
        env_file = ".env"

    @field_validator("secret_key")
    @classmethod
    def _strong_secret(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+psycopg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+psycopg://", 1)
        return url


settings = Settings()
