from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas import ContactRequest
from app.utils.email import contact_notification_email, send_email
from app.utils.limiter import limiter

router = APIRouter(prefix="/api/contact", tags=["contact"])


@router.post("")
@limiter.limit("5/minute")
def contact(request: Request, body: ContactRequest, db: Session = Depends(get_db)):
    # Messages are delivered by email only (they are not stored), so a failed send means a lost message.
    admin_email = settings.mail_username
    sent = bool(admin_email) and send_email(
        admin_email,
        f"[Sharing Excess Contact] {body.subject or 'New message'}",
        contact_notification_email(body.name, body.email, body.subject, body.message),
    )
    if not sent:
        raise HTTPException(503, "We couldn't deliver your message just now. Please try again in a few minutes.")
    return {"success": True, "message": "Message sent successfully"}
