"""In-app bell + email notifications.

`notify()` only writes the bell row and queues the email on the session; nothing is sent until the caller
has committed and hands the queue to `schedule_emails()` (a FastAPI background task), so a slow or failing
SMTP server never delays or breaks a request, and nobody is emailed about a change that rolled back.
"""
import logging
from typing import Iterable, Optional

from fastapi import BackgroundTasks
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.constants import NEIGHBOURS
from app.database import SessionLocal
from app.models import FoodListing, Notification, User
from app.utils.email import new_event_email, notice_email, send_email

logger = logging.getLogger(__name__)
MAX_NOTIFY = 500  # one announcement reaches at most this many people


def notify(db: Session, user: User, kind: str, title: str, body: str = "", link: Optional[str] = None,
           details: Optional[list[tuple[str, str]]] = None, email: bool = True) -> None:
    db.add(Notification(user_id=user.id, kind=kind, title=title, body=body, link=link))
    if email and user.notify_email and user.email:
        db.info.setdefault("outbox", []).append(
            (user.email, f"{title} – Sharing Excess", notice_email(title, body, link, details=details)))


def _send_all(items: list[tuple[str, str, str]]) -> None:
    for to, subject, html in items:
        try:
            send_email(to, subject, html)
        except Exception:  # one bad address must not stop the rest
            logger.exception("Could not email %s", to)


def schedule_emails(background: BackgroundTasks, db: Session) -> None:
    """Call after db.commit(): sends the queued emails once the response has gone out."""
    items = db.info.pop("outbox", [])
    if items:
        background.add_task(_send_all, items)


def send_queued_now(db: Session) -> None:
    """For code that runs outside a request (the expiry sweeper, announcements)."""
    _send_all(db.info.pop("outbox", []))


def _wants_district(user: User, district: str) -> bool:
    if user.notify_districts:
        return district in user.notify_districts
    if user.district:
        return district == user.district or district in NEIGHBOURS.get(user.district, ())
    return True   # no district and no preference: tell them about everything


def matching_receivers(db: Session, listing: FoodListing) -> list[User]:
    """Recipients / approved NGOs whose chosen districts and food types fit this listing."""
    q = db.query(User).filter(
        User.status == "active",
        User.id != listing.donor_id,
        or_(User.role == "recipient", (User.role == "ngo") & (User.ngo_status == "approved")),
    )
    out = []
    for u in q.limit(5000):
        if u.notify_food_types and listing.category not in u.notify_food_types:
            continue
        if _wants_district(u, listing.district):
            out.append(u)
        if len(out) >= MAX_NOTIFY:
            break
    return out


def announce_listing(listing_id: int) -> None:
    """Background task: bell + email every matching receiver about a new listing."""
    db = SessionLocal()
    try:
        listing = db.get(FoodListing, listing_id)
        if not listing or listing.status != "active":
            return
        qty = f"{listing.quantity_available:g} {listing.unit}"
        for u in matching_receivers(db, listing):
            where = listing.district + (f" ({listing.area})" if listing.area else "")
            notify(db, u, "new_listing", f"New food near you: {listing.food_name}",
                   f"{qty} available in {where}.", f"/listings/{listing.id}",
                   details=[("Quantity", qty), ("District", listing.district)])
        db.commit()
        send_queued_now(db)
    except Exception:  # an announcement problem must never break posting food
        logger.exception("Could not announce listing %s", listing_id)
        db.rollback()
    finally:
        db.close()


def announce_event(event_id: int, subscriber_emails: Iterable[str] = ()) -> None:
    """Background task: bell + email users in the event's district, plus the newsletter subscribers."""
    from app.models import CommunityEvent

    db = SessionLocal()
    try:
        event = db.get(CommunityEvent, event_id)
        if not event or event.status != "published":
            return
        when = event.starts_at.strftime("%A, %d %B %Y at %I:%M %p")
        mail = new_event_email(event.title, when, event.location, event.description)
        subject = f"New event: {event.title} - Sharing Excess"
        emailed: set[str] = set()
        users = db.query(User).filter(User.status == "active", User.role != "admin",
                                      User.id != (event.owner_id or 0)).limit(5000)
        count = 0
        for u in users:
            if not _wants_district(u, event.district):
                continue
            notify(db, u, "new_event", f"New event: {event.title}", f"{when} – {event.location}",
                   "/events", email=False)
            if u.notify_email and u.email:
                db.info.setdefault("outbox", []).append((u.email, subject, mail))
                emailed.add(u.email.lower())
            count += 1
            if count >= MAX_NOTIFY:
                break
        for address in subscriber_emails:
            if address.lower() not in emailed:
                db.info.setdefault("outbox", []).append((address, subject, mail))
        db.commit()
        send_queued_now(db)
    except Exception:
        logger.exception("Could not announce event %s", event_id)
        db.rollback()
    finally:
        db.close()
