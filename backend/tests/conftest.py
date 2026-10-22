import os

# Settings require a strong SECRET_KEY; set one before any app module loads
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-0123456789")

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://divedebrief:divedebrief@localhost:5432/divedebrief_test",
)


def _ensure_database(url: str) -> None:
    target = make_url(url)
    admin = create_engine(target.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            exists = conn.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": target.database}
            )
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{target.database}"'))
    finally:
        admin.dispose()


@pytest.fixture(scope="session")
def engine():
    try:
        _ensure_database(TEST_DATABASE_URL)
    except OperationalError as e:
        pytest.skip(f"Postgres not reachable for API tests: {e.orig}")

    from app import models  # noqa: F401  (registers tables on Base.metadata)
    from app.database import Base

    eng = create_engine(TEST_DATABASE_URL)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture
def anon_client(engine):
    from fastapi.testclient import TestClient

    from app.database import get_db
    from app.main import app

    TestSession = sessionmaker(bind=engine, autoflush=False)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE users, uploads, dives, samples RESTART IDENTITY CASCADE"))


def sign_up(client, email="diver@example.com", password="correct-horse"):
    """Register and log in; returns the Authorization header."""
    assert client.post("/auth/register", json={"email": email, "password": password}).status_code == 201
    res = client.post("/auth/login", data={"username": email, "password": password})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture
def client(anon_client):
    """A client signed in as a fresh diver."""
    anon_client.headers.update(sign_up(anon_client))
    return anon_client
