"""Check-in rules (09 §2, 15 §4 item 1)."""

import threading
from datetime import datetime, timedelta, timezone

import pytest

import database

pytestmark = pytest.mark.checkin


def rows(db_conn, user_id):
    with db_conn.cursor() as cur:
        cur.execute('SELECT date, treatment_taken, notes FROM daily_checkin WHERE "userId" = %s ORDER BY date', (user_id,))
        return cur.fetchall()


def test_checkin_creates_row(client, db_conn, user_id):
    res = client.post("/checkin", json={"user_id": user_id, "treatment_taken": True, "notes": "n"})
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"success", "checkin_id", "is_new_record", "effective_date"}
    assert body["success"] is True and body["is_new_record"] is True
    assert body["effective_date"] == datetime.now(timezone.utc).date().isoformat()  # default tz UTC
    assert rows(db_conn, user_id) == [(body["effective_date"], True, "n")]


def test_same_day_upsert(client, db_conn, user_id):
    first = client.post("/checkin", json={"user_id": user_id, "treatment_taken": True}).json()
    second = client.post("/checkin", json={"user_id": user_id, "treatment_taken": False, "notes": "x"}).json()
    assert second["is_new_record"] is False
    assert second["checkin_id"] == first["checkin_id"]
    assert len(rows(db_conn, user_id)) == 1
    assert rows(db_conn, user_id)[0][1] is False


@pytest.mark.slow
def test_concurrent_checkins_single_row(db_conn, user_id):
    barrier = threading.Barrier(5)
    results, errors = [], []

    def worker():
        barrier.wait()
        try:
            results.append(database.save_daily_checkin(user_id, True, "", "UTC", ""))
        except Exception as exc:  # pragma: no cover - surfaced below
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not errors
    assert len(rows(db_conn, user_id)) == 1
    assert sum(r.is_new_record for r in results) == 1
    assert len({r.checkin_id for r in results}) == 1


def test_future_dated_rejected(client, user_id):
    future = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    res = client.post("/checkin", json={"user_id": user_id, "treatment_taken": True, "logged_date": future})
    assert res.status_code == 400
    assert res.json() == {"detail": "Security Exception: Future-dated logs are strictly rejected."}


def test_within_five_minute_tolerance_accepted(client, user_id):
    soon = (datetime.now(timezone.utc) + timedelta(minutes=4)).isoformat()
    res = client.post("/checkin", json={"user_id": user_id, "treatment_taken": True, "logged_date": soon})
    assert res.status_code == 200


def test_timezone_localization(client, user_id):
    res = client.post("/checkin", json={
        "user_id": user_id, "treatment_taken": True,
        "client_timezone": "America/New_York", "logged_date": "2026-01-01T03:00:00Z",
    })
    assert res.status_code == 200
    assert res.json()["effective_date"] == "2025-12-31"


def test_epoch_milliseconds_and_seconds():
    assert database.resolve_checkin_date("UTC", "1767225600000") == "2026-01-01"  # ms
    assert database.resolve_checkin_date("UTC", "1767225600") == "2026-01-01"     # s
    assert database.resolve_checkin_date("UTC", "1767225600.5") == "2026-01-01"


def test_naive_iso_is_utc_and_invalid_tz_falls_back():
    assert database.resolve_checkin_date("Not/AZone", "2026-03-10T23:30:00") == "2026-03-10"
    assert database.resolve_checkin_date("Asia/Tokyo", "2026-03-10T23:30:00") == "2026-03-11"


def test_unparseable_date_uses_now():
    now = datetime(2026, 5, 1, 12, tzinfo=timezone.utc)
    assert database.resolve_checkin_date("UTC", "not-a-date", now_utc=now) == "2026-05-01"


def test_javascript_iso_with_millis_and_z():
    # submitCheckin sends new Date().toISOString()
    assert database.resolve_checkin_date("UTC", "2026-06-20T10:00:00.000Z") == "2026-06-20"


def test_past_dates_backfill(client, db_conn, user_id):
    res = client.post("/checkin", json={"user_id": user_id, "treatment_taken": True, "logged_date": "2026-01-15T12:00:00Z"})
    assert res.status_code == 200 and res.json()["effective_date"] == "2026-01-15"


def test_missing_user_id_422(client):
    res = client.post("/checkin", json={"treatment_taken": True})
    assert res.status_code == 422


def test_internal_secret_enforced_only_when_set(client, user_id, monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", "s3cret")
    body = {"user_id": user_id, "treatment_taken": True}
    assert client.post("/checkin", json=body).status_code == 401
    assert client.post("/checkin", json=body, headers={"X-Internal-Secret": "wrong"}).status_code == 401
    assert client.post("/checkin", json=body, headers={"X-Internal-Secret": "s3cret"}).status_code == 200
    # Browser-called routes stay open (no shared secret required).
    assert client.get("/health").status_code == 200
    monkeypatch.delenv("INTERNAL_API_SECRET")
    assert client.post("/checkin", json=body).status_code == 200
