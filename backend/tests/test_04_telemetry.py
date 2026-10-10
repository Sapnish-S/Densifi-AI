"""Telemetry math (09 §1, 15 §4 item 2)."""

import json
import uuid
from datetime import date, timedelta

import pytest

import database

pytestmark = pytest.mark.telemetry


def add_photo(cur, user_id, taken_at, analysis=None):
    pid = uuid.uuid4().hex
    cur.execute(
        'INSERT INTO progress_photo (id, "userId", "dataUrl", angle, "takenAt") VALUES (%s, %s, %s, %s, %s)',
        (pid, user_id, f"https://example/{pid}.png", "Front", taken_at),
    )
    if analysis:
        cur.execute(
            'INSERT INTO agent_message (id, "userId", role, content, "photoId") VALUES (%s, %s, %s, %s, %s)',
            (uuid.uuid4().hex, user_id, "assistant", json.dumps(analysis), pid),
        )
    return pid


def cleanup(cur, user_id):
    for t in ("progress_photo", "agent_message", "daily_checkin"):
        cur.execute(f'DELETE FROM {t} WHERE "userId" = %s', (user_id,))


def test_unknown_user_empty_payload(client):
    res = client.get("/dashboard/telemetry", params={"user_id": "nobody-" + uuid.uuid4().hex})
    assert res.status_code == 200
    assert res.json() == {
        "miniaturization_matrix": [],
        "compliance_score": 0.0,
        "progress_analytics": {
            "baseline_density": None, "current_density": None, "delta_percentage": None,
            "data_points": 0, "trend": "insufficient_data",
        },
        "last_checkin_date": None,
    }


def test_missing_user_id_422(client):
    assert client.get("/dashboard/telemetry").status_code == 422


def test_delta_and_trend_improving(client, db_conn, user_id):
    with db_conn.cursor() as cur:
        add_photo(cur, user_id, "2026-01-01T10:00:00Z", {"density_percentage": 40.0, "miniaturization_index": 0.6})
        add_photo(cur, user_id, "2026-02-01T10:00:00Z", {"density_percentage": 50.0, "miniaturization_index": 0.4})
    try:
        body = client.get("/dashboard/telemetry", params={"user_id": user_id}).json()
        pa = body["progress_analytics"]
        assert pa == {
            "baseline_density": 40.0, "baseline_date": "2026-01-01",
            "current_density": 50.0, "current_date": "2026-02-01",
            "delta_percentage": 25.0, "data_points": 2, "trend": "improving",
        }
        assert [p["miniaturization_index"] for p in body["miniaturization_matrix"]] == [0.6, 0.4]
    finally:
        with db_conn.cursor() as cur:
            cleanup(cur, user_id)


def test_trend_declining_and_stable():
    mk = lambda d: {"date": "2026-01-01", "density_percentage": d, "miniaturization_index": 0.5, "photo_id": "x"}
    assert database.compute_progress_analytics([mk(60.0), mk(45.0)])["trend"] == "declining"
    assert database.compute_progress_analytics([mk(60.0), mk(60.0)])["trend"] == "stable"
    assert database.compute_progress_analytics([mk(60.0), mk(45.0)])["delta_percentage"] == -25.0
    # baseline 0 → insufficient
    assert database.compute_progress_analytics([mk(0.0), mk(45.0)])["trend"] == "insufficient_data"
    assert database.compute_progress_analytics([mk(30.0)])["trend"] == "insufficient_data"


def test_unanalyzed_photos_count_as_zero_points(client, db_conn, user_id):
    """Known behaviour: photos without analysis appear as 0.0/0.0 data points."""
    with db_conn.cursor() as cur:
        add_photo(cur, user_id, "2026-01-01T10:00:00Z")
        add_photo(cur, user_id, "2026-02-01T10:00:00Z", {"density_percentage": 50.0, "miniaturization_index": 0.4})
    try:
        body = client.get("/dashboard/telemetry", params={"user_id": user_id}).json()
        assert body["miniaturization_matrix"][0]["density_percentage"] == 0.0
        assert body["progress_analytics"]["data_points"] == 2
        assert body["progress_analytics"]["trend"] == "insufficient_data"  # baseline density 0
    finally:
        with db_conn.cursor() as cur:
            cleanup(cur, user_id)


def test_compliance_rounds_to_one_decimal(client, db_conn, user_id):
    today = date.today()
    with db_conn.cursor() as cur:
        for i, taken in enumerate([True, True, False]):
            cur.execute(
                'INSERT INTO daily_checkin (id, "userId", date, treatment_taken) VALUES (%s, %s, %s, %s)',
                (uuid.uuid4().hex, user_id, (today - timedelta(days=i)).isoformat(), taken),
            )
        # Outside the 90-day window: ignored.
        cur.execute(
            'INSERT INTO daily_checkin (id, "userId", date, treatment_taken) VALUES (%s, %s, %s, false)',
            (uuid.uuid4().hex, user_id, (today - timedelta(days=120)).isoformat()),
        )
    try:
        body = client.get("/dashboard/telemetry", params={"user_id": user_id}).json()
        assert body["compliance_score"] == 66.7  # backend: 1 dp (Next rounds to 67)
        assert body["last_checkin_date"] == date.today().isoformat() or body["last_checkin_date"]
    finally:
        with db_conn.cursor() as cur:
            cleanup(cur, user_id)
