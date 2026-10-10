"""
Brevo transactional email client + the four HTML templates.
Sent from FastAPI BackgroundTasks; failures are logged only. Template values are
interpolated without HTML escaping.
"""

from __future__ import annotations

import logging
import os

import requests

logger = logging.getLogger("densify.email")

BREVO_URL = "https://api.brevo.com/v3/smtp/email"
TIMEOUT_SECONDS = 10


def _sender() -> dict:
    return {
        "name": os.getenv("EMAIL_SENDER_NAME", "Densify Clinical"),
        "email": os.getenv("EMAIL_SENDER_ADDRESS", "densly.official@gmail.com"),
    }


def _base_html(content: str) -> str:
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; background-color: #ffffff; color: #18181b; font-family: 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; max-width: 600px; margin: 0 auto; border-collapse: collapse;">
  <tr><td style="background-color: #000000; padding: 24px; text-align: center;">
    <span style="color: #ffffff; font-size: 14px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; text-decoration: none;">DENSIFY CLINICAL</span></td></tr>
  <tr><td style="padding: 40px 24px; font-size: 16px; line-height: 1.6; color: #18181b;">{content}</td></tr>
  <tr><td style="padding: 0 24px;"><hr style="border: none; border-top: 1px solid #e4e4e7; margin: 0;" /></td></tr>
  <tr><td style="padding: 32px 24px; text-align: center; font-size: 12px; color: #a1a1aa; line-height: 1.5;">
    &copy; 2026 Densify Health. All rights reserved.<br>This is an automated clinical notification. Please do not reply to this email.</td></tr>
</table></body></html>"""


def _otp_block(otp: str) -> str:
    return (
        '<div style="background-color: #000000; border-radius: 8px; padding: 24px; text-align: center; margin: 32px 0;">'
        f'<span style="font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: 8px;">{otp}</span></div>'
    )


def welcome_otp_email(otp: str) -> tuple[str, str]:
    content = (
        '<p style="margin-top: 0;">Your clinical hair tracking begins now. Enter the 6-digit code below to verify your vault access.</p>'
        + _otp_block(otp)
    )
    return "Welcome to Densify. Your Verification Code.", _base_html(content)


def password_reset_email(otp: str) -> tuple[str, str]:
    content = (
        '<p style="margin-top: 0;">Use the 6-digit code below to securely update your credentials.</p>'
        + _otp_block(otp)
    )
    return "Densify: Secure Password Reset Request", _base_html(content)


def appointment_confirmation_email(doctor_name: str) -> tuple[str, str]:
    content = (
        f'<p style="margin-top: 0;">You have booked a consultation with {doctor_name}.</p>'
        '<div style="margin: 24px 0; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">'
        f'<p style="margin: 0 0 8px 0;"><strong>Clinician:</strong> {doctor_name}</p>'
        '<p style="margin: 0;"><strong>Status:</strong> Pending Scheduling</p></div>'
        "<p style=\"margin-bottom: 12px;\">The doctor's assistant will send you a follow up email stating when might be the best time to schedule your appointment but moreover you can always chat to the doctor inside the app.</p>"
        '<p style="margin-bottom: 0; font-size: 13px; color: #71717a;"><em>Note: Please make sure that you don\'t spam messages after messages which can lead to disable your chat for a minute or so.</em></p>'
    )
    return "Confirmed: Your Consultation Request with Densify", _base_html(content)


def appointment_cancellation_email(doctor_name: str, appointment_date: str) -> tuple[str, str]:
    content = (
        f'<p style="margin-top: 0;">Your appointment with Dr. {doctor_name} on {appointment_date} has been successfully canceled. '
        "You can reschedule at any time via your patient dashboard.</p>"
    )
    return "Canceled: Your Clinical Review with Densify", _base_html(content)


def send_email_sync(to_email: str, subject: str, html_content: str) -> bool:
    api_key = os.getenv("BREVO_API_KEY")
    if not api_key:
        logger.warning("Email service disabled: BREVO_API_KEY not set in environment.")
        return False
    try:
        response = requests.post(
            BREVO_URL,
            headers={"accept": "application/json", "api-key": api_key, "content-type": "application/json"},
            json={"sender": _sender(), "to": [{"email": to_email}], "subject": subject, "htmlContent": html_content},
            timeout=TIMEOUT_SECONDS,
        )
        if response.status_code >= 400:
            logger.error("Brevo send failed (%s): %s", response.status_code, response.text)
            return False
        logger.info("Email '%s' sent to %s", subject, to_email)
        return True
    except Exception as exc:
        logger.error("Brevo send error: %s", exc)
        return False
