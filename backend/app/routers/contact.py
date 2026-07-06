import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ContactRequest
from app.utils.email import send_email, contact_notification_email

router = APIRouter(prefix="/api/contact", tags=["contact"])


@router.post("")
def contact(body: ContactRequest, db: Session = Depends(get_db)):
    admin_email = os.getenv("MAIL_USERNAME", "")
    if admin_email:
        send_email(
            admin_email,
            f"[Sharing Excess Contact] {body.subject or 'New message'}",
            contact_notification_email(body.name, body.email, body.subject, body.message),
        )
    return {"success": True, "message": "Message sent successfully"}
