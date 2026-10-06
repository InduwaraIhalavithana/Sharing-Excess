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


def money_donation_email(name: str, amount: float) -> str:
    name = escape(name)
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


def request_accepted_email(recipient_name: str, food_name: str, donor_name: str, donor_phone: str) -> str:
    recipient_name = escape(recipient_name)
    food_name = escape(food_name)
    donor_name = escape(donor_name)
    donor_phone = escape(donor_phone)
    phone_line = f"<p>📞 Donor phone: <b>{donor_phone}</b></p>" if donor_phone else ""
    return f"""
<html><body style="font-family:Arial,sans-serif;color:#333">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:20px;text-align:center;border-radius:10px 10px 0 0">
      <h1>Sharing Excess</h1><p>Your request has been accepted!</p>
    </div>
    <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px">
      <h2>Great news, {recipient_name}!</h2>
      <p>Your request for <b>{food_name}</b> has been accepted by donor <b>{donor_name}</b>.</p>
      {phone_line}
      <p>Please coordinate with the donor to arrange pickup or delivery.</p>
      <p>Thank you for using Sharing Excess!</p>
    </div>
  </div>
</body></html>"""


def request_declined_email(recipient_name: str, food_name: str) -> str:
    recipient_name = escape(recipient_name)
    food_name = escape(food_name)
    return f"""
<html><body style="font-family:Arial,sans-serif;color:#333">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;padding:20px;text-align:center;border-radius:10px 10px 0 0">
      <h1>Sharing Excess</h1><p>Request update</p>
    </div>
    <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px">
      <h2>Hello {recipient_name},</h2>
      <p>Unfortunately, your request for <b>{food_name}</b> was not able to be fulfilled at this time.</p>
      <p>Please check our listings for other available food items. We hope to find a match for you soon!</p>
      <p>— The Sharing Excess Team</p>
    </div>
  </div>
</body></html>"""


def request_delivered_email(recipient_name: str, food_name: str) -> str:
    recipient_name = escape(recipient_name)
    food_name = escape(food_name)
    return f"""
<html><body style="font-family:Arial,sans-serif;color:#333">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:20px;text-align:center;border-radius:10px 10px 0 0">
      <h1>Sharing Excess</h1><p>Food delivered!</p>
    </div>
    <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px">
      <h2>Hello {recipient_name}!</h2>
      <p>Your food request for <b>{food_name}</b> has been marked as delivered.</p>
      <p>We hope the food reached you safely. Please consider leaving feedback to help our donors!</p>
      <p>Thank you for being part of the Sharing Excess community.</p>
    </div>
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


def listing_approved_email(donor_name: str, food_name: str) -> str:
    donor_name, food_name = escape(donor_name), escape(food_name)
    return f"""
<html><body style="font-family:Arial,sans-serif;color:#333">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:20px;text-align:center;border-radius:10px 10px 0 0">
      <h1>Sharing Excess</h1><p>Your listing is live</p>
    </div>
    <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px">
      <h2>Hello {donor_name},</h2>
      <p>Good news - your listing <b>{food_name}</b> has been checked by our team and is now visible to people who need it.</p>
      <p>You will get another email when someone requests it. Thank you for sharing!</p>
      <p>- The Sharing Excess Team</p>
    </div>
  </div>
</body></html>"""


def listing_rejected_email(donor_name: str, food_name: str, reason: str) -> str:
    donor_name, food_name, reason = escape(donor_name), escape(food_name), escape(reason)
    return f"""
<html><body style="font-family:Arial,sans-serif;color:#333">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#d97706,#b45309);color:#fff;padding:20px;text-align:center;border-radius:10px 10px 0 0">
      <h1>Sharing Excess</h1><p>Your listing needs a change</p>
    </div>
    <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px">
      <h2>Hello {donor_name},</h2>
      <p>We could not publish your listing <b>{food_name}</b> yet. The reviewer wrote:</p>
      <blockquote style="border-left:4px solid #d97706;margin:16px 0;padding:8px 16px;background:#fff">{reason}</blockquote>
      <p>You are welcome to add a corrected listing from your dashboard. We appreciate you wanting to help.</p>
      <p>- The Sharing Excess Team</p>
    </div>
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
