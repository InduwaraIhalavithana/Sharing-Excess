import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, html_body: str) -> bool:
    """Send an HTML email via Gmail SMTP (SSL port 465). Returns True on success."""
    host      = os.getenv("MAIL_HOST", "smtp.gmail.com")
    port      = int(os.getenv("MAIL_PORT", "465"))
    username  = os.getenv("MAIL_USERNAME", "")
    password  = os.getenv("MAIL_PASSWORD", "")
    from_name = os.getenv("MAIL_FROM_NAME", "Sharing Excess")

    if not username or not password:
        logger.warning("SMTP credentials not configured — email not sent")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{from_name} <{username}>"
    msg["To"]      = to
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP_SSL(host, port) as server:
            server.login(username, password)
            server.sendmail(username, to, msg.as_string())
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)
        return False


# ── Email templates ──────────────────────────────────────────────────────────

def verification_email(name: str, code: str) -> str:
    return f"""
<html><body style="font-family:Arial,sans-serif;color:#333">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:20px;text-align:center;border-radius:10px 10px 0 0">
      <h1>Sharing Excess</h1><p>Verify your email address</p>
    </div>
    <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px">
      <h2>Hello {name}!</h2>
      <p>Thank you for registering. Use the code below to activate your account:</p>
      <div style="background:#16a34a;color:#fff;padding:15px;text-align:center;font-size:28px;font-weight:bold;border-radius:5px;margin:20px 0;letter-spacing:6px">{code}</div>
      <p>This code is valid for one use. If you did not create this account, ignore this email.</p>
      <p>Best regards,<br>The Sharing Excess Team</p>
    </div>
  </div>
</body></html>"""


def forgot_password_email(code: str) -> str:
    return f"""
<html><body style="font-family:Arial,sans-serif;color:#333">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <h2 style="color:#16a34a">Password Reset – Sharing Excess</h2>
    <p>Use the code below to reset your password:</p>
    <div style="background:#16a34a;color:#fff;padding:15px;text-align:center;font-size:28px;font-weight:bold;border-radius:5px;margin:20px 0;letter-spacing:6px">{code}</div>
    <p>If you did not request a reset, ignore this email.</p>
    <p>— The Sharing Excess Team</p>
  </div>
</body></html>"""


def money_donation_email(name: str, amount: float) -> str:
    return f"""
<html><body style="font-family:Arial,sans-serif;color:#333">
  <div style="max-width:600px;margin:0 auto;padding:20px;text-align:center">
    <h2 style="color:#16a34a">Thank You for Your Generous Donation!</h2>
    <p>Dear {name},</p>
    <p>We truly appreciate your support. Your donation of <b>Rs {amount:,.2f}</b>
       will help us provide meals to those in need.</p>
    <p style="color:#2563eb">Together, we can end hunger. Thank you for being a hero!</p>
    <p style="font-size:13px;color:#888">— The Sharing Excess Team</p>
  </div>
</body></html>"""


def contact_notification_email(name: str, sender_email: str, subject: str, message: str) -> str:
    return f"""
<html><body style="font-family:Arial,sans-serif;color:#333">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <h2 style="color:#16a34a">New Contact Form Submission</h2>
    <p><b>From:</b> {name} ({sender_email})</p>
    <p><b>Subject:</b> {subject}</p>
    <hr>
    <p>{message}</p>
  </div>
</body></html>"""
