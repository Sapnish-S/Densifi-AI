"""
Database layer for the Densify Core Engine (PostgreSQL via psycopg2).

The pool connects with a static DATABASE_URL over TLS (CA from PGSSLROOTCERT path or
PG_CA_CERT PEM text). Pool sizes (1/8), connect_timeout (10 s) and a check-in retry loop
on SerializationFailure are configured below.
"""

from __future__ import annotations

import logging
import os
import random
import tempfile
import threading
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

import psycopg2
import psycopg2.errors
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

logger = logging.getLogger("densify.database")

POOL_MIN = 1
POOL_MAX = 8
CONNECT_TIMEOUT = 10
CHECKIN_MAX_ATTEMPTS = 8

_pool: Optional[ThreadedConnectionPool] = None
_pool_lock = threading.Lock()


# ── Connection management ────────────────────────────────────────────────────


def _ssl_root_cert() -> Optional[str]:
    """Path to the Managed PostgreSQL CA. PG_CA_CERT (PEM text) is written to a temp file."""
    path = os.getenv("PGSSLROOTCERT")
    if path:
        return path
    pem = os.getenv("PG_CA_CERT")
    if not pem:
        return None
    handle = tempfile.NamedTemporaryFile("w", suffix=".crt", delete=False)
    handle.write(pem)
    handle.close()
    return handle.name


def _connect_kwargs() -> dict[str, Any]:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")
    kwargs: dict[str, Any] = {"dsn": dsn, "connect_timeout": CONNECT_TIMEOUT}
    root_cert = _ssl_root_cert()
    if root_cert:
        kwargs["sslrootcert"] = root_cert
    return kwargs


def get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = ThreadedConnectionPool(POOL_MIN, POOL_MAX, **_connect_kwargs())
                logger.info("PostgreSQL connection pool created (min=%s, max=%s)", POOL_MIN, POOL_MAX)
    return _pool


def refresh_pool() -> None:
    """Rebuild the pool (used to recover from broken connections)."""
    global _pool
    with _pool_lock:
        if _pool is not None:
            try:
                _pool.closeall()
            except Exception:  # pragma: no cover - best effort
                pass
        _pool = None
    get_pool()


def close_pool() -> None:
    global _pool
    with _pool_lock:
        if _pool is not None:
            _pool.closeall()
            _pool = None
            logger.info("PostgreSQL connection pool closed")


@contextmanager
def get_connection():
    pool = get_pool()
    conn = pool.getconn()
    broken = False
    try:
        yield conn
    except (psycopg2.OperationalError, psycopg2.InterfaceError):
        broken = True
        raise
    finally:
        try:
            if not conn.closed:
                conn.rollback()
        except Exception:
            broken = True
        pool.putconn(conn, close=broken or bool(conn.closed))


# ── Telemetry (mirrors Next getTelemetry; backend rounds compliance to 1 dp) ──


@dataclass
class TelemetryResult:
    miniaturization_matrix: list[dict] = field(default_factory=list)
    compliance_score: float = 0.0
    progress_analytics: dict = field(default_factory=dict)
    last_checkin_date: Optional[str] = None


def _empty_progress(data_points: int) -> dict:
    return {
        "baseline_density": None,
        "current_density": None,
        "delta_percentage": None,
        "data_points": data_points,
        "trend": "insufficient_data",
    }


def compute_progress_analytics(matrix: list[dict]) -> dict:
    progress = _empty_progress(len(matrix))
    if len(matrix) >= 2 and matrix[0]["density_percentage"] > 0:
        baseline, current = matrix[0], matrix[-1]
        delta = round(current["density_percentage"] - baseline["density_percentage"], 2)
        delta_pct = round(delta / baseline["density_percentage"] * 100, 1)
        trend = "improving" if delta > 0 else "declining" if delta < 0 else "stable"
        progress = {
            "baseline_density": baseline["density_percentage"],
            "baseline_date": baseline["date"],
            "current_density": current["density_percentage"],
            "current_date": current["date"],
            "delta_percentage": delta_pct,
            "data_points": len(matrix),
            "trend": trend,
        }
    return progress


def get_dashboard_telemetry(user_id: str) -> TelemetryResult:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT p.id AS photo_id,
                       TO_CHAR(p."takenAt", 'YYYY-MM-DD') AS date,
                       COALESCE((am.content::json ->> 'density_percentage')::float, 0.0)    AS density_percentage,
                       COALESCE((am.content::json ->> 'miniaturization_index')::float, 0.0) AS miniaturization_index
                FROM progress_photo p
                LEFT JOIN agent_message am
                  ON am."photoId" = p.id AND am."userId" = %s AND am.role = 'assistant'
                 AND am.content LIKE '%%miniaturization_index%%'
                WHERE p."userId" = %s
                ORDER BY p."takenAt" ASC
                LIMIT 90
                """,
                (user_id, user_id),
            )
            matrix = [
                {
                    "date": row["date"],
                    "density_percentage": float(row["density_percentage"] or 0.0),
                    "miniaturization_index": float(row["miniaturization_index"] or 0.0),
                    "photo_id": row["photo_id"],
                }
                for row in cur.fetchall()
            ]

            today = date.today()
            start = today - timedelta(days=90)
            cur.execute(
                """
                SELECT COUNT(*) AS total_days,
                       COUNT(CASE WHEN treatment_taken THEN 1 END) AS taken_days,
                       MAX("createdAt") AS last_checkin
                FROM daily_checkin
                WHERE "userId" = %s AND date >= %s AND date <= %s
                """,
                (user_id, start.isoformat(), today.isoformat()),
            )
            row = cur.fetchone() or {}

    total = int(row.get("total_days") or 0)
    taken = int(row.get("taken_days") or 0)
    compliance = round(taken / total * 100, 1) if total > 0 else 0.0
    last = row.get("last_checkin")
    last_checkin_date = last.isoformat()[:10] if isinstance(last, datetime) else (str(last)[:10] if last else None)

    return TelemetryResult(
        miniaturization_matrix=matrix,
        compliance_score=compliance,
        progress_analytics=compute_progress_analytics(matrix),
        last_checkin_date=last_checkin_date,
    )


# ── Daily check-in ───────────────────────────────────────────────────────────


@dataclass
class CheckinResult:
    success: bool
    checkin_id: str
    is_new_record: bool
    effective_date: str


FUTURE_TOLERANCE = timedelta(minutes=5)
FUTURE_DATED_MESSAGE = "Security Exception: Future-dated logs are strictly rejected."


def resolve_checkin_date(client_timezone: str, logged_date: str, now_utc: Optional[datetime] = None) -> str:
    """Return the YYYY-MM-DD the check-in belongs to in the client's timezone."""
    try:
        tz = ZoneInfo(client_timezone or "UTC")
    except Exception:
        tz = ZoneInfo("UTC")
    now_utc = now_utc or datetime.now(timezone.utc)

    if not logged_date:
        logged_dt = now_utc
    elif logged_date.replace(".", "", 1).isdigit():
        val = float(logged_date)
        if val > 1e11:  # epoch milliseconds
            val = val / 1000
        logged_dt = datetime.fromtimestamp(val, timezone.utc)
    else:
        try:
            logged_dt = datetime.fromisoformat(logged_date)
            if logged_dt.tzinfo is None:
                logged_dt = logged_dt.replace(tzinfo=timezone.utc)
        except ValueError:
            logged_dt = now_utc

    if logged_dt > now_utc + FUTURE_TOLERANCE:
        raise ValueError(FUTURE_DATED_MESSAGE)
    return logged_dt.astimezone(tz).date().isoformat()


def save_daily_checkin(
    user_id: str,
    treatment_taken: bool,
    notes: str = "",
    client_timezone: str = "UTC",
    logged_date: str = "",
) -> CheckinResult:
    today = resolve_checkin_date(client_timezone, logged_date)

    for attempt in range(CHECKIN_MAX_ATTEMPTS):
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        'SELECT id FROM daily_checkin WHERE "userId" = %s AND date = %s LIMIT 1',
                        (user_id, today),
                    )
                    existing = cur.fetchone()
                    if existing:
                        cur.execute(
                            'UPDATE daily_checkin SET treatment_taken = %s, notes = %s, "updatedAt" = now() WHERE id = %s',
                            (treatment_taken, notes, existing[0]),
                        )
                        conn.commit()
                        return CheckinResult(True, existing[0], False, today)

                    new_id = str(uuid.uuid4())
                    try:
                        cur.execute(
                            'INSERT INTO daily_checkin (id, "userId", date, treatment_taken, notes, "createdAt", "updatedAt") '
                            "VALUES (%s, %s, %s, %s, %s, now(), now())",
                            (new_id, user_id, today, treatment_taken, notes),
                        )
                        conn.commit()
                        return CheckinResult(True, new_id, True, today)
                    except psycopg2.errors.UniqueViolation:
                        # A concurrent request inserted the same (userId, date) first.
                        conn.rollback()
                        cur.execute(
                            'SELECT id FROM daily_checkin WHERE "userId" = %s AND date = %s LIMIT 1',
                            (user_id, today),
                        )
                        winner = cur.fetchone()
                        cur.execute(
                            'UPDATE daily_checkin SET treatment_taken = %s, notes = %s, "updatedAt" = now() WHERE id = %s',
                            (treatment_taken, notes, winner[0]),
                        )
                        conn.commit()
                        return CheckinResult(True, winner[0], False, today)
        except (psycopg2.errors.SerializationFailure, psycopg2.OperationalError) as exc:
            if attempt < CHECKIN_MAX_ATTEMPTS - 1:
                delay = (0.05 + random.random() * 0.1) * (attempt + 1)
                logger.warning("Check-in conflict (attempt %s): %s — retrying in %.2fs", attempt + 1, exc, delay)
                time.sleep(delay)
            else:
                raise
    return None  # type: ignore[return-value]  # unreachable


# ── OTP / password helpers (write directly into Better Auth tables) ──────────


def _store_otp(identifier: str, otp: str, minutes: int) -> bool:
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM verification WHERE identifier = %s", (identifier,))
                cur.execute(
                    'INSERT INTO verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt") '
                    "VALUES (%s, %s, %s, now() + %s * interval '1 minute', now(), now())",
                    (str(uuid.uuid4()), identifier, otp, minutes),
                )
                conn.commit()
        return True
    except Exception as exc:
        logger.error("Failed to store OTP for %s: %s", identifier, exc)
        return False


def set_verification_otp(email: str, otp: str, minutes: int = 15) -> bool:
    return _store_otp(email, otp, minutes)


def set_password_reset_otp(email: str, otp: str, minutes: int = 10) -> bool:
    return _store_otp(f"reset:{email}", otp, minutes)


def verify_email_otp(email: str, otp: str) -> bool:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT id FROM verification WHERE identifier = %s AND value = %s AND "expiresAt" > now() LIMIT 1',
                (email, otp),
            )
            row = cur.fetchone()
            if not row:
                return False
            cur.execute('UPDATE "user" SET "emailVerified" = true, "updatedAt" = now() WHERE email = %s', (email,))
            cur.execute("DELETE FROM verification WHERE id = %s", (row[0],))
            conn.commit()
            return True


def get_user_password_hash(email: str) -> Optional[str]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT a.password FROM "user" u JOIN account a ON a."userId" = u.id '
                "WHERE u.email = %s AND a.password IS NOT NULL LIMIT 1",
                (email,),
            )
            row = cur.fetchone()
            return row[0] if row else None


def check_user_verified(email: str) -> Optional[bool]:
    """True/False for an existing user, None when no such user."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT "emailVerified" FROM "user" WHERE email = %s LIMIT 1', (email,))
            row = cur.fetchone()
            return bool(row[0]) if row else None


def update_password_with_otp(email: str, otp: str, new_hash: str) -> bool:
    identifier = f"reset:{email}"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT id FROM verification WHERE identifier = %s AND value = %s AND "expiresAt" > now() LIMIT 1',
                (identifier, otp),
            )
            otp_row = cur.fetchone()
            if not otp_row:
                return False
            cur.execute('SELECT id FROM "user" WHERE email = %s LIMIT 1', (email,))
            user_row = cur.fetchone()
            if not user_row:
                return False
            cur.execute(
                'UPDATE account SET password = %s, "updatedAt" = now() WHERE "userId" = %s',
                (new_hash, user_row[0]),
            )
            cur.execute("DELETE FROM verification WHERE id = %s", (otp_row[0],))
            conn.commit()
            return True
