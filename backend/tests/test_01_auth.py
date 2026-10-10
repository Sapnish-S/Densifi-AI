"""Auth helpers (07 §1, 10 §1, 15 §4 item 5) + Brevo email templates (09 §12)."""

import uuid

import bcrypt
import pytest

import email_service

pytestmark = pytest.mark.auth

# Produced by bcrypt-ts 8.0.1 hashSync("Js-Created-Pass1", 12) — what Better Auth stores.
JS_HASH = "$2b$12$Y3hfHUtfEOwYJXvnLjzPoeqqjhfgZ7vjpI0RrfTqoCUF8AfT8dYN2"


def otp_rows(db_conn, identifier):
    with db_conn.cursor() as cur:
        cur.execute('SELECT value, "expiresAt" - now() FROM verification WHERE identifier = %s', (identifier,))
        return cur.fetchall()


def is_verified(db_conn, email):
    with db_conn.cursor() as cur:
        cur.execute('SELECT "emailVerified" FROM "user" WHERE email = %s', (email,))
        return cur.fetchone()[0]


@pytest.fixture()
def sent_emails(monkeypatch):
    sent = []
    monkeypatch.setattr(email_service, "send_email_sync", lambda to, subject, html: sent.append((to, subject, html)))
    return sent


def test_root_and_health(client):
    assert client.get("/").json() == {"status": "online", "engine": "Densify Core Engine", "version": "1.0.0", "docs": "/docs"}
    assert client.get("/health").json() == {"status": "healthy"}
    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200


def test_python_bcrypt_verifies_js_hash():
    assert bcrypt.checkpw(b"Js-Created-Pass1", JS_HASH.encode())
    assert not bcrypt.checkpw(b"wrong", JS_HASH.encode())


def test_signup_creates_otp_and_queues_email(client, db_conn, make_user, sent_emails):
    user = make_user(verified=False)
    res = client.post("/signup", json={"email": user["email"]})
    assert res.status_code == 200
    assert res.json() == {"message": "Signup successful, verification email queued."}
    rows = otp_rows(db_conn, user["email"])
    assert len(rows) == 1 and len(rows[0][0]) == 6 and rows[0][0].isdigit()
    assert 14 * 60 < rows[0][1].total_seconds() <= 15 * 60
    assert sent_emails[0][1] == "Welcome to Densify. Your Verification Code."
    assert rows[0][0] in sent_emails[0][2]


def test_signup_replaces_previous_otp(client, db_conn, make_user, sent_emails):
    user = make_user(verified=False)
    client.post("/signup", json={"email": user["email"]})
    client.post("/signup", json={"email": user["email"]})
    assert len(otp_rows(db_conn, user["email"])) == 1


def test_verify_email_flow(client, db_conn, make_user, sent_emails):
    user = make_user(verified=False)
    client.post("/signup", json={"email": user["email"]})
    otp = otp_rows(db_conn, user["email"])[0][0]
    wrong = "000000" if otp != "000000" else "111111"
    bad = client.post("/verify-email", json={"email": user["email"], "otp": wrong})
    assert bad.status_code == 400 and bad.json() == {"detail": "Invalid or expired verification code."}
    ok = client.post("/verify-email", json={"email": user["email"], "otp": otp})
    assert ok.status_code == 200 and ok.json() == {"message": "Email verified successfully."}
    assert is_verified(db_conn, user["email"]) is True
    assert otp_rows(db_conn, user["email"]) == []


def test_expired_otp_rejected(client, db_conn, make_user):
    user = make_user(verified=False)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO verification (id, identifier, value, "expiresAt") VALUES (%s, %s, %s, now() - interval \'1 minute\')',
            (uuid.uuid4().hex, user["email"], "123456"),
        )
    assert client.post("/verify-email", json={"email": user["email"], "otp": "123456"}).status_code == 400


def test_login_precheck_paths(client, make_user):
    verified = make_user(password="Correct-Pass1")
    unverified = make_user(password="Correct-Pass1", verified=False)

    ok = client.post("/api/auth/login", json={"email": verified["email"], "password": "Correct-Pass1"})
    assert ok.status_code == 200 and ok.json() == {"detail": "Pre-check passed", "verified": True}

    wrong = client.post("/api/auth/login", json={"email": verified["email"], "password": "nope"})
    assert wrong.status_code == 401 and wrong.json() == {"detail": "Invalid email or password."}

    missing = client.post("/api/auth/login", json={"email": "ghost@autotest.internal", "password": "x"})
    assert missing.status_code == 401

    blocked = client.post("/api/auth/login", json={"email": unverified["email"], "password": "Correct-Pass1"})
    assert blocked.status_code == 403
    assert blocked.json() == {"detail": "User not verified", "requires_verification": True, "email": unverified["email"]}


def test_login_precheck_accepts_js_created_hash(client, db_conn, make_user):
    user = make_user()
    with db_conn.cursor() as cur:
        cur.execute('UPDATE account SET password = %s WHERE "userId" = %s', (JS_HASH, user["id"]))
    res = client.post("/api/auth/login", json={"email": user["email"], "password": "Js-Created-Pass1"})
    assert res.status_code == 200


def test_login_precheck_rejects_scrypt_hash(client, db_conn, make_user):
    """Legacy Better Auth scrypt hashes contain ':' → bcrypt ValueError → 401."""
    user = make_user()
    with db_conn.cursor() as cur:
        cur.execute('UPDATE account SET password = %s WHERE "userId" = %s', ("abcd1234:deadbeef", user["id"]))
    assert client.post("/api/auth/login", json={"email": user["email"], "password": "x"}).status_code == 401


def test_resend_otp(client, db_conn, make_user, sent_emails):
    unverified = make_user(verified=False)
    verified = make_user()
    assert client.post("/api/auth/resend-otp", json={"email": "ghost@autotest.internal"}).json() == {"detail": "User not found."}
    already = client.post("/api/auth/resend-otp", json={"email": verified["email"]})
    assert already.status_code == 400 and already.json() == {"detail": "User is already verified."}
    ok = client.post("/api/auth/resend-otp", json={"email": unverified["email"]})
    assert ok.status_code == 200 and ok.json() == {"message": "OTP resent successfully."}
    rows = otp_rows(db_conn, unverified["email"])
    assert len(rows) == 1 and 9 * 60 < rows[0][1].total_seconds() <= 10 * 60


def test_forgot_password_always_200(client, db_conn, sent_emails):
    email = f"unknown-{uuid.uuid4().hex}@autotest.internal"
    res = client.post("/forgot-password", json={"email": email})
    assert res.status_code == 200
    assert res.json() == {"message": "If the email is registered, a recovery link has been sent."}
    # Known behaviour: OTP stored and emailed even for unknown addresses.
    rows = otp_rows(db_conn, f"reset:{email}")
    assert len(rows) == 1 and 100000 <= int(rows[0][0]) <= 999999
    assert sent_emails[0][1] == "Densify: Secure Password Reset Request"
    with db_conn.cursor() as cur:
        cur.execute("DELETE FROM verification WHERE identifier = %s", (f"reset:{email}",))


def test_reset_password_flow(client, db_conn, make_user, sent_emails):
    user = make_user(password="Old-Password1")
    client.post("/forgot-password", json={"email": user["email"]})
    otp = otp_rows(db_conn, f"reset:{user['email']}")[0][0]

    same = client.post("/reset-password", json={"email": user["email"], "otp_code": otp, "new_password": "Old-Password1"})
    assert same.status_code == 400
    assert same.json() == {"detail": "Your new password cannot be the same as your old password."}

    bad = client.post("/reset-password", json={"email": user["email"], "otp_code": "000000" if otp != "000000" else "111111", "new_password": "New-Password1"})
    assert bad.status_code == 400 and bad.json() == {"detail": "Invalid or expired reset code."}

    ok = client.post("/reset-password", json={"email": user["email"], "otp_code": otp, "new_password": "New-Password1"})
    assert ok.status_code == 200 and ok.json() == {"message": "Password reset successfully."}
    with db_conn.cursor() as cur:
        cur.execute('SELECT password FROM account WHERE "userId" = %s', (user["id"],))
        new_hash = cur.fetchone()[0]
    assert new_hash.startswith("$2b$12$")  # bcrypt default cost 12 → verifiable by bcrypt-ts
    assert client.post("/api/auth/login", json={"email": user["email"], "password": "New-Password1"}).status_code == 200
    assert otp_rows(db_conn, f"reset:{user['email']}") == []


def test_same_password_check_runs_before_otp(client, make_user):
    """Known behaviour: reusing the old password is rejected even with a bogus OTP."""
    user = make_user(password="Old-Password1")
    res = client.post("/reset-password", json={"email": user["email"], "otp_code": "bogus", "new_password": "Old-Password1"})
    assert res.json() == {"detail": "Your new password cannot be the same as your old password."}


def test_appointments(client, sent_emails):
    book = client.post("/api/appointments/book", json={"email": "p@example.com", "doctor_name": "Dr. E. Butler", "date_time": "2026-06-20 09:00:00"})
    assert book.status_code == 200 and book.json() == {"message": "Appointment confirmed, email queued."}
    assert sent_emails[-1][1] == "Confirmed: Your Consultation Request with Densify"
    assert "You have booked a consultation with Dr. E. Butler." in sent_emails[-1][2]

    cancel = client.post("/api/appointments/cancel/abc", json={"email": "p@example.com"})
    assert cancel.status_code == 200 and cancel.json() == {"message": "Appointment canceled, email queued."}
    assert "Your appointment with Dr. your Clinician on the scheduled date has been successfully canceled." in sent_emails[-1][2]

    assert client.post("/api/appointments/book", json={"email": "p@example.com"}).status_code == 422


def test_email_templates():
    subject, html = email_service.welcome_otp_email("012345")
    assert subject == "Welcome to Densify. Your Verification Code."
    assert "Enter the 6-digit code below to verify your vault access." in html
    assert "letter-spacing: 8px;\">012345</span>" in html
    assert "&copy; 2026 Densify Health. All rights reserved.<br>This is an automated clinical notification." in html
    assert email_service.password_reset_email("1")[0] == "Densify: Secure Password Reset Request"
    assert email_service.appointment_cancellation_email("X", "Y")[0] == "Canceled: Your Clinical Review with Densify"


def test_missing_brevo_key_skips(monkeypatch, caplog):
    monkeypatch.delenv("BREVO_API_KEY", raising=False)
    assert email_service.send_email_sync("a@b.c", "s", "<p/>") is False
    assert "Email service disabled: BREVO_API_KEY not set in environment." in caplog.text


def test_brevo_request_shape(monkeypatch):
    captured = {}

    class Resp:
        status_code = 201
        text = "{}"

    def fake_post(url, headers, json, timeout):
        captured.update(url=url, headers=headers, json=json, timeout=timeout)
        return Resp()

    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setattr(email_service.requests, "post", fake_post)
    assert email_service.send_email_sync("to@example.com", "Subj", "<p>x</p>") is True
    assert captured["url"] == "https://api.brevo.com/v3/smtp/email"
    assert captured["headers"] == {"accept": "application/json", "api-key": "xkeysib-test", "content-type": "application/json"}
    assert captured["json"] == {
        "sender": {"name": "Densify Clinical", "email": "densifyai@gmail.com"},
        "to": [{"email": "to@example.com"}], "subject": "Subj", "htmlContent": "<p>x</p>",
    }
    assert captured["timeout"] == 10
