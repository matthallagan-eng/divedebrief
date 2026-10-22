from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://divedebrief:divedebrief@localhost:5432/divedebrief"
    cors_origins: str = "http://localhost:5173"
    # Required, no default: a missing or weak key must stop the app starting
    secret_key: str
    access_token_expire_minutes: int = 60 * 24 * 7
    max_upload_bytes: int = 10 * 1024 * 1024
    # Default ascent-rate limit used for the stored violation count (m/min)
    default_ascent_limit_m_per_min: float = 9.0

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
