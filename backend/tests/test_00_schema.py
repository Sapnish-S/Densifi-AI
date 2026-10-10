"""Schema: tables, indexes and unique constraints."""

import uuid

import psycopg2
import pytest

pytestmark = pytest.mark.schema

TABLES = {
    "user", "session", "account", "verification", "profile", "progress_photo", "agent_message",
    "agent_daily_count", "medication", "lab_report", "daily_checkin", "notification_prefs", "retention_check_in",
}
INDEXES = {
    "idx_user_email", "idx_session_token", "idx_session_user", "idx_account_user", "idx_profile_user",
    "idx_photo_user", "idx_agent_msg_user", "idx_agent_count_user", "idx_medication_user",
    "idx_lab_report_user", "idx_daily_checkin_user_date",
}


def test_all_tables_exist(db_conn):
    with db_conn.cursor() as cur:
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        assert TABLES <= {r[0] for r in cur.fetchall()}


def test_all_indexes_exist(db_conn):
    with db_conn.cursor() as cur:
        cur.execute("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")
        assert INDEXES <= {r[0] for r in cur.fetchall()}


@pytest.mark.parametrize(
    "table,column",
    [
        ("user", "emailVerified"), ("session", "userId"), ("profile", "displayName"),
        ("progress_photo", "dataUrl"), ("progress_photo", "takenAt"), ("agent_message", "photoId"),
        ("lab_report", "freeT"), ("lab_report", "reportDate"), ("medication", "startDate"),
        ("daily_checkin", "treatment_taken"), ("notification_prefs", "has_completed_onboarding"),
        ("retention_check_in", "planned_start_date"),
    ],
)
def test_exact_identifiers(db_conn, table, column):
    """Quoted camelCase and snake_case identifiers must match exactly."""
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM information_schema.columns WHERE table_name = %s AND column_name = %s", (table, column)
        )
        assert cur.fetchone(), f'{table}."{column}" missing'


def _expect_unique_violation(db_conn, sql, params):
    with db_conn.cursor() as cur:
        with pytest.raises(psycopg2.errors.UniqueViolation):
            cur.execute(sql, params)


def test_unique_user_email(db_conn):
    email = f"dup-{uuid.uuid4().hex}@autotest.internal"
    ids = [f"u-{uuid.uuid4().hex[:8]}" for _ in range(2)]
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "user" (id, name, email) VALUES (%s, %s, %s)', (ids[0], "a", email))
    _expect_unique_violation(db_conn, 'INSERT INTO "user" (id, name, email) VALUES (%s, %s, %s)', (ids[1], "b", email))
    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM "user" WHERE email = %s', (email,))


def test_unique_session_token(db_conn):
    token = uuid.uuid4().hex
    sql = 'INSERT INTO session (id, "expiresAt", token, "userId") VALUES (%s, now() + interval \'1 day\', %s, %s)'
    with db_conn.cursor() as cur:
        cur.execute(sql, (uuid.uuid4().hex, token, "u1"))
    _expect_unique_violation(db_conn, sql, (uuid.uuid4().hex, token, "u2"))
    with db_conn.cursor() as cur:
        cur.execute("DELETE FROM session WHERE token = %s", (token,))


def test_unique_profile_user(db_conn, user_id):
    sql = 'INSERT INTO profile (id, "userId") VALUES (%s, %s)'
    with db_conn.cursor() as cur:
        cur.execute(sql, (uuid.uuid4().hex, user_id))
    _expect_unique_violation(db_conn, sql, (uuid.uuid4().hex, user_id))
    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM profile WHERE "userId" = %s', (user_id,))


def test_unique_daily_checkin_user_date(db_conn, user_id):
    sql = 'INSERT INTO daily_checkin (id, "userId", date, treatment_taken) VALUES (%s, %s, %s, true)'
    with db_conn.cursor() as cur:
        cur.execute(sql, (uuid.uuid4().hex, user_id, "2026-01-01"))
    _expect_unique_violation(db_conn, sql, (uuid.uuid4().hex, user_id, "2026-01-01"))
    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM daily_checkin WHERE "userId" = %s', (user_id,))


def test_defaults(db_conn, user_id):
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO profile (id, "userId") VALUES (%s, %s) RETURNING tier', (uuid.uuid4().hex, user_id))
        assert cur.fetchone()[0] == "free"
        cur.execute(
            'INSERT INTO progress_photo (id, "userId", "dataUrl") VALUES (%s, %s, %s) RETURNING angle',
            (uuid.uuid4().hex, user_id, "data:x"),
        )
        assert cur.fetchone()[0] == "crown"
        cur.execute('DELETE FROM profile WHERE "userId" = %s', (user_id,))
        cur.execute('DELETE FROM progress_photo WHERE "userId" = %s', (user_id,))
