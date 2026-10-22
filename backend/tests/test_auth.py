from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import text

from app.config import settings
from conftest import sign_up
from test_api import _upload


def test_register_login_and_me(anon_client):
    headers = sign_up(anon_client, email="  Diver@Example.COM ")
    me = anon_client.get("/auth/me", headers=headers).json()
    assert me["email"] == "diver@example.com"


def test_duplicate_email_is_rejected_case_insensitively(anon_client):
    sign_up(anon_client)
    res = anon_client.post("/auth/register", json={"email": "DIVER@example.com", "password": "another-pass"})
    assert res.status_code == 409


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": "long-enough"},
        {"email": "diver@example.com", "password": "short"},
        {"email": "diver@example.com", "password": "x" * 73},
    ],
)
def test_register_validates_input(anon_client, payload):
    assert anon_client.post("/auth/register", json=payload).status_code == 422


def test_wrong_password_and_unknown_email_look_the_same(anon_client):
    sign_up(anon_client)
    wrong = anon_client.post("/auth/login", data={"username": "diver@example.com", "password": "nope-nope"})
    unknown = anon_client.post("/auth/login", data={"username": "ghost@example.com", "password": "nope-nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


@pytest.mark.parametrize(
    "method, path",
    [("get", "/dives"), ("get", "/dives/1"), ("delete", "/dives/1"),
     ("get", "/uploads"), ("post", "/uploads"), ("delete", "/uploads/1"), ("get", "/auth/me")],
)
def test_endpoints_require_a_token(anon_client, method, path):
    assert getattr(anon_client, method)(path).status_code == 401


def test_expired_and_forged_tokens_are_rejected(anon_client):
    sign_up(anon_client)
    expired = jwt.encode(
        {"sub": "1", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.secret_key, algorithm="HS256",
    )
    forged = jwt.encode({"sub": "1"}, "some-other-secret-that-is-long-enough!!", algorithm="HS256")
    unsigned = jwt.encode({"sub": "1"}, None, algorithm="none")
    for token in (expired, forged, unsigned, "garbage"):
        res = anon_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 401, token


def test_divers_only_see_their_own_data(anon_client):
    alice = sign_up(anon_client, "alice@example.com")
    bob = sign_up(anon_client, "bob@example.com")
    anon_client.headers.update(alice)
    upload_id = _upload(anon_client).json()["upload_id"]
    [dive] = anon_client.get("/dives").json()

    anon_client.headers.update(bob)
    assert anon_client.get("/dives").json() == []
    assert anon_client.get("/uploads").json() == []
    assert anon_client.get(f"/dives/{dive['id']}").status_code == 404
    assert anon_client.delete(f"/dives/{dive['id']}").status_code == 404
    assert anon_client.delete(f"/uploads/{upload_id}").status_code == 404

    anon_client.headers.update(alice)
    assert len(anon_client.get("/dives").json()) == 1


def test_same_dive_can_be_logged_by_two_divers(anon_client):
    for email in ("alice@example.com", "bob@example.com"):
        anon_client.headers.update(sign_up(anon_client, email))
        assert _upload(anon_client).json()["added"] == 1


def test_first_account_claims_dives_from_before_accounts(anon_client, engine):
    # Simulate a V1 logbook: rows with no owner
    owner = sign_up(anon_client, "temp@example.com")
    anon_client.headers.update(owner)
    _upload(anon_client)
    with engine.begin() as conn:
        conn.execute(text("UPDATE uploads SET user_id = NULL"))
        conn.execute(text("UPDATE dives SET user_id = NULL"))
        conn.execute(text("DELETE FROM users"))

    anon_client.headers.update(sign_up(anon_client, "first@example.com"))
    assert len(anon_client.get("/dives").json()) == 1
    assert len(anon_client.get("/uploads").json()) == 1

    anon_client.headers.update(sign_up(anon_client, "second@example.com"))
    assert anon_client.get("/dives").json() == []
