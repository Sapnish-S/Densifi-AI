"""
Densify Core Engine — FastAPI service.

Notes:
  * CORS origins come from CORS_ALLOW_ORIGINS.
  * Optional shared-secret check: when INTERNAL_API_SECRET is set, the routes
    that only Next.js server actions call (/checkin, /analyze, /analyze-lab,
    /agent-chat, /dashboard/telemetry) require header X-Internal-Secret. Disabled when unset.
"""

from __future__ import annotations

import base64
import hmac
import logging
import os
import random
from contextlib import asynccontextmanager
from dataclasses import asdict

import bcrypt
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

load_dotenv()

import analyzer  # noqa: E402  (env must be loaded first)
import database  # noqa: E402
import email_service  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s — %(message)s")
logger = logging.getLogger("densify.main")

DEFAULT_CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("Densify Core Engine starting up…")
    yield
    logger.info("Densify Core Engine shutting down…")
    database.close_pool()


app = FastAPI(
    title="Densify Core Engine",
    description=(
        "Production API for the Densify clinical hair-health SaaS platform. "
        "Backed by PostgreSQL and an AWS Bedrock dual-model AI pipeline."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", DEFAULT_CORS_ORIGINS).split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_internal_secret(x_internal_secret: str | None = Header(default=None)) -> None:
    expected = os.getenv("INTERNAL_API_SECRET")
    if not expected:
        return
    if not x_internal_secret or not hmac.compare_digest(x_internal_secret, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


# ── Models ───────────────────────────────────────────────────────────────────


class CheckinRequest(BaseModel):
    user_id: str
    treatment_taken: bool
    notes: str = ""
    client_timezone: str = "UTC"
    logged_date: str = ""


class AnalyzeRequest(BaseModel):
    user_id: str
    baseline_s3_key: str
    current_s3_key: str


class LabAnalyzeRequest(BaseModel):
    user_id: str
    data_url: str


class ChatMessage(BaseModel):
    role: str
    content: str


class AgentChatRequest(BaseModel):
    user_id: str
    message: str
    history: list[ChatMessage] = []


class EmailRequest(BaseModel):
    email: str


class VerifyEmailRequest(BaseModel):
    email: str
    otp: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp_code: str
    new_password: str


class BookAppointmentRequest(BaseModel):
    email: str
    doctor_name: str
    date_time: str


class CancelAppointmentRequest(BaseModel):
    email: str
    doctor_name: str = "your Clinician"
    appointment_date: str = "the scheduled date"


def _ai_error_response(result: dict) -> JSONResponse:
    return JSONResponse(status_code=503 if result.get("recoverable") else 422, content=result)


# ── Health ───────────────────────────────────────────────────────────────────


@app.get("/")
def root():
    return {"status": "online", "engine": "Densify Core Engine", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}


# ── Telemetry / check-in ─────────────────────────────────────────────────────


@app.get("/dashboard/telemetry", dependencies=[Depends(require_internal_secret)])
def dashboard_telemetry(user_id: str = Query(...)):
    try:
        return asdict(database.get_dashboard_telemetry(user_id))
    except Exception as exc:
        logger.error("Telemetry failed for %s: %s", user_id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve dashboard telemetry: {exc}")


@app.post("/checkin", dependencies=[Depends(require_internal_secret)])
def checkin(req: CheckinRequest):
    try:
        result = database.save_daily_checkin(
            req.user_id, req.treatment_taken, req.notes, req.client_timezone, req.logged_date
        )
        return asdict(result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Check-in failed for %s: %s", req.user_id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to save check-in: {exc}")


# ── AI ───────────────────────────────────────────────────────────────────────


@app.post("/analyze", dependencies=[Depends(require_internal_secret)])
def analyze(req: AnalyzeRequest):
    logger.info("Analysis requested by %s", req.user_id)
    result = analyzer.analyze_vault_image(req.baseline_s3_key, req.current_s3_key)
    if result.get("error"):
        return _ai_error_response(result)
    return result


@app.post("/analyze-lab", dependencies=[Depends(require_internal_secret)])
def analyze_lab(req: LabAnalyzeRequest):
    try:
        payload = req.data_url.split(",", 1)[1] if "," in req.data_url else req.data_url
        pdf_bytes = base64.b64decode(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    result = analyzer.analyze_lab_report(pdf_bytes)
    if result.get("error"):
        return _ai_error_response(result)
    return result


@app.post("/agent-chat", dependencies=[Depends(require_internal_secret)])
def agent_chat(req: AgentChatRequest):
    try:
        reply = analyzer.chat_with_agent(req.message, [m.model_dump() for m in req.history])
        return {"reply": reply}
    except Exception as exc:
        logger.error("Agent chat failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to reach chat agent.")


# ── Auth helpers (OTP verification, login pre-check, password reset) ─────────


@app.post("/signup")
def signup(req: EmailRequest, background_tasks: BackgroundTasks):
    otp = f"{random.randint(0, 999999):06d}"
    if not database.set_verification_otp(req.email, otp, minutes=15):
        raise HTTPException(status_code=500, detail="Failed to generate verification code. Please try again later.")
    subject, html = email_service.welcome_otp_email(otp)
    background_tasks.add_task(email_service.send_email_sync, req.email, subject, html)
    return {"message": "Signup successful, verification email queued."}


@app.post("/verify-email")
def verify_email(req: VerifyEmailRequest):
    if not database.verify_email_otp(req.email, req.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")
    return {"message": "Email verified successfully."}


@app.post("/api/auth/login")
def login_precheck(req: LoginRequest):
    password_hash = database.get_user_password_hash(req.email)
    if not password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    try:
        valid = bcrypt.checkpw(req.password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        valid = False
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if database.check_user_verified(req.email) is False:
        return JSONResponse(
            status_code=403,
            content={"detail": "User not verified", "requires_verification": True, "email": req.email},
        )
    return {"detail": "Pre-check passed", "verified": True}


@app.post("/api/auth/resend-otp")
def resend_otp(req: EmailRequest, background_tasks: BackgroundTasks):
    verified = database.check_user_verified(req.email)
    if verified is None:
        raise HTTPException(status_code=404, detail="User not found.")
    if verified:
        raise HTTPException(status_code=400, detail="User is already verified.")
    otp = f"{random.randint(0, 999999):06d}"
    if not database.set_verification_otp(req.email, otp, minutes=10):
        raise HTTPException(status_code=500, detail="Failed to generate new verification code. Please try again later.")
    subject, html = email_service.welcome_otp_email(otp)
    background_tasks.add_task(email_service.send_email_sync, req.email, subject, html)
    return {"message": "OTP resent successfully."}


@app.post("/forgot-password")
def forgot_password(req: EmailRequest, background_tasks: BackgroundTasks):
    otp = f"{random.randint(100000, 999999):06d}"
    if database.set_password_reset_otp(req.email, otp, minutes=10):
        subject, html = email_service.password_reset_email(otp)
        background_tasks.add_task(email_service.send_email_sync, req.email, subject, html)
    return {"message": "If the email is registered, a recovery link has been sent."}


@app.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    current_hash = database.get_user_password_hash(req.email)
    if current_hash and bcrypt.checkpw(req.new_password.encode("utf-8"), current_hash.encode("utf-8")):
        raise HTTPException(status_code=400, detail="Your new password cannot be the same as your old password.")
    new_hash = bcrypt.hashpw(req.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    if not database.update_password_with_otp(req.email, req.otp_code, new_hash):
        raise HTTPException(status_code=400, detail="Invalid or expired reset code.")
    return {"message": "Password reset successfully."}


# ── Appointments (mock network; email only, no persistence) ──────────────────


@app.post("/api/appointments/book")
def book_appointment(req: BookAppointmentRequest, background_tasks: BackgroundTasks):
    parts = req.date_time.split(" ", 1)
    appointment_date = parts[0]
    appointment_time = parts[1] if len(parts) > 1 else "TBD"
    logger.info("Booking %s with %s on %s at %s", req.email, req.doctor_name, appointment_date, appointment_time)
    subject, html = email_service.appointment_confirmation_email(req.doctor_name)
    background_tasks.add_task(email_service.send_email_sync, req.email, subject, html)
    return {"message": "Appointment confirmed, email queued."}


@app.post("/api/appointments/cancel/{appointment_id}")
def cancel_appointment(appointment_id: str, req: CancelAppointmentRequest, background_tasks: BackgroundTasks):
    subject, html = email_service.appointment_cancellation_email(req.doctor_name, req.appointment_date)
    background_tasks.add_task(email_service.send_email_sync, req.email, subject, html)
    return {"message": "Appointment canceled, email queued."}
