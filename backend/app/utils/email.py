import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape

from app.config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, html_body: str) -> bool:
    """Send an HTML email via Gmail SMTP (SSL port 465). Returns True on success."""
    host, port = settings.mail_host, settings.mail_port
    username, password = settings.mail_username, settings.mail_password
    from_name = settings.mail_from_name

    if not username or not password:
        logger.warning("SMTP credentials not configured — email not sent")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = " ".join(subject.split())   # a line break in a header would be a header-injection hole
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
    name = escape(name)
    code = escape(code)
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
    code = escape(code)
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






def contact_notification_email(name: str, sender_email: str, subject: str, message: str) -> str:
    name = escape(name)
    sender_email = escape(sender_email)
    subject = escape(subject)
    message = escape(message)
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




def new_event_email(title: str, when: str, location: str, description: str) -> str:
    title, when, location, description = escape(title), escape(when), escape(location), escape(description)
    return f"""
<html><body style="font-family:Arial,sans-serif;color:#333">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#16a34a,#0d9488);color:#fff;padding:20px;text-align:center;border-radius:10px 10px 0 0">
      <h1>Sharing Excess</h1><p>A new community event</p>
    </div>
    <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px">
      <h2>{title}</h2>
      <p>&#128197; <b>{when}</b><br>&#128205; {location}</p>
      <p>{description}</p>
      <p>Open the Events page on Sharing Excess to join. You are receiving this because you asked to be notified about events.</p>
    </div>
  </div>
</body></html>"""


def notice_email(title: str, body: str, link: str | None = None, link_text: str = "Open Sharing Excess",
                 details: list[tuple[str, str]] | None = None) -> str:
    """One layout for every in-app notification that is also emailed. `link` is an in-app route."""
    title, body = escape(title), escape(body)
    rows = "".join(f"<p style='margin:4px 0'><b>{escape(k)}:</b> {escape(v)}</p>" for k, v in (details or []) if v)
    button = ""
    if link:
        url = escape(settings.frontend_url.rstrip("/") + link)
        button = (f"<p style='margin:24px 0'><a href='{url}' style='background:#16a34a;color:#fff;padding:12px 22px;"
                  f"border-radius:8px;text-decoration:none;font-weight:bold'>{escape(link_text)}</a></p>")
    return f"""
<html><body style="font-family:Arial,sans-serif;color:#333">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:20px;text-align:center;border-radius:10px 10px 0 0">
      <h1>Sharing Excess</h1>
    </div>
    <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px">
      <h2>{title}</h2>
      <p>{body}</p>
      {rows}
      {button}
      <p style="font-size:12px;color:#888">You can change which emails you get under Profile &rarr; Notifications.</p>
    </div>
  </div>
</body></html>"""
