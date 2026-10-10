"""
Test fixtures for the Densify Core Engine.

These run against a real PostgreSQL 16 (an isolated
`densify_test` database created from db/migrations) with the LLM and object storage
mocked, so they are deterministic and run in CI.

Env:
  TEST_ADMIN_DATABASE_URL  connection used to (re)create the test DB
                           (default: DATABASE_URL, else postgresql://densify:densify@db:5432/densify)
"""

from __future__ import annotations

import os
import pathlib
import uuid
from urllib.parse import urlparse, urlunparse

import psycopg2
import pytest

ADMIN_URL = os.getenv("TEST_ADMIN_DATABASE_URL") or os.getenv("DATABASE_URL") or "postgresql://densify:densify@db:5432/densify"
TEST_DB = "densify_test"
MIGRATIONS = pathlib.Path(__file__).resolve().parents[2] / "db" / "migrations"
if not MIGRATIONS.exists():  # bind-mounted layout inside the test container
    MIGRATIONS = pathlib.Path("/db/migrations")


def _with_db(url: str, dbname: str) -> str:
    parts = urlparse(url)
    return urlunparse(parts._replace(path=f"/{dbname}"))


TEST_URL = _with_db(ADMIN_URL, TEST_DB)


def _bootstrap_test_db() -> None:
    admin = psycopg2.connect(ADMIN_URL)
    admin.autocommit = True
    with admin.cursor() as cur:
        cur.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)")
        cur.execute(f"CREATE DATABASE {TEST_DB}")
    admin.close()
    conn = psycopg2.connect(TEST_URL)
    conn.autocommit = True
    with conn.cursor() as cur:
        for sql_file in sorted(MIGRATIONS.glob("*.sql")):
            cur.execute(sql_file.read_text(encoding="utf-8"))
    conn.close()


# Configure the app before it is imported by any test module.
_bootstrap_test_db()
os.environ["DATABASE_URL"] = TEST_URL
os.environ.pop("INTERNAL_API_SECRET", None)
os.environ.pop("BREVO_API_KEY", None)

import database  # noqa: E402
import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(main.app)


@pytest.fixture()
def db_conn():
    conn = psycopg2.connect(TEST_URL)
    conn.autocommit = True
    yield conn
    conn.close()


@pytest.fixture()
def user_id() -> str:
    return f"test-{uuid.uuid4().hex[:12]}"


@pytest.fixture()
def make_user(db_conn):
    """Insert a Better Auth user + credential account. Returns a factory."""
    import bcrypt

    created: list[str] = []

    def _make(email: str | None = None, password: str = "CorrectHorse1", verified: bool = True, tier: str | None = None):
        uid = f"test-{uuid.uuid4().hex[:12]}"
        email = email or f"densify-test-{uid}@autotest.internal"
        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()
        with db_conn.cursor() as cur:
            cur.execute(
                'INSERT INTO "user" (id, name, email, "emailVerified") VALUES (%s, %s, %s, %s)',
                (uid, "Densify E2E Test User", email, verified),
            )
            cur.execute(
                'INSERT INTO account (id, "accountId", "providerId", "userId", password) VALUES (%s, %s, %s, %s, %s)',
                (str(uuid.uuid4()), uid, "credential", uid, pw_hash),
            )
            if tier:
                cur.execute(
                    'INSERT INTO profile (id, "userId", tier) VALUES (%s, %s, %s)', (str(uuid.uuid4()), uid, tier)
                )
        created.append(uid)
        return {"id": uid, "email": email, "password": password}

    yield _make

    with db_conn.cursor() as cur:
        for uid in created:
            for table in ("account", "session", "profile", "daily_checkin", "progress_photo", "agent_message"):
                cur.execute(f'DELETE FROM {table} WHERE "userId" = %s', (uid,))
            cur.execute('DELETE FROM "user" WHERE id = %s', (uid,))
