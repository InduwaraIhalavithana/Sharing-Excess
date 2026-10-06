"""Community events (food drives, volunteer sessions): staff publish them, anyone can browse,
signed-in users can join, and email subscribers hear about new ones."""
import logging
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.dependencies import get_current_user, is_staff, optional_user, require_staff
from app.models import CommunityEvent, EventSignup, EventSubscriber, User
from app.schemas import EventIn, SubscribeRequest
from app.utils.email import new_event_email, send_email
from app.utils.limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/community-events", tags=["events"])

COLOMBO = ZoneInfo("Asia/Colombo")
MAX_NOTIFY = 500  # one send per subscriber; cap a single announcement


def now_colombo() -> datetime:
    """Event times are stored as Sri Lanka wall-clock time (naive), so compare with the same."""
    return datetime.now(COLOMBO).replace(tzinfo=None)


def _out(e: CommunityEvent, going: int, joined: bool) -> dict:
    end = e.ends_at or e.starts_at
    spots_left = None if e.capacity is None else max(e.capacity - going, 0)
    return {
        "id": e.id,
        "title": e.title,
        "description": e.description,
        "location": e.location,
        "starts_at": e.starts_at.isoformat(),
        "ends_at": e.ends_at.isoformat() if e.ends_at else None,
        "capacity": e.capacity,
        "going": going,
        "spots_left": spots_left,
        "full": spots_left == 0,
        "is_past": end < now_colombo(),
        "joined": joined,
    }


def _counts(db: Session) -> dict[int, int]:
    return dict(db.query(EventSignup.event_id, func.count(EventSignup.id)).group_by(EventSignup.event_id).all())


@router.get("")
def list_events(db: Session = Depends(get_db), me: Optional[User] = Depends(optional_user)):
    counts = _counts(db)
    mine = {s.event_id for s in db.query(EventSignup).filter(EventSignup.user_id == me.id)} if me else set()
    events = db.query(CommunityEvent).order_by(CommunityEvent.starts_at.asc()).all()
    return {"success": True, "events": [_out(e, counts.get(e.id, 0), e.id in mine) for e in events]}


def _announce(event_id: int) -> None:
    """Email every subscriber about a new event (runs after the response is sent)."""
    db = SessionLocal()
    try:
        event = db.get(CommunityEvent, event_id)
        if not event:
            return
        for sub in db.query(EventSubscriber).limit(MAX_NOTIFY):
            send_email(sub.email, f"New event: {event.title} - Sharing Excess",
                       new_event_email(event.title, event.starts_at.strftime("%A, %d %B %Y at %I:%M %p"),
                                       event.location, event.description))
    except Exception:  # an email problem must never break event publishing
        logger.exception("Could not announce event %s", event_id)
    finally:
        db.close()


@router.post("")
def create_event(body: EventIn, background: BackgroundTasks, db: Session = Depends(get_db),
                 me: User = Depends(require_staff)):
    event = CommunityEvent(created_by=me.id, **body.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    background.add_task(_announce, event.id)
    return {"success": True, "event": _out(event, 0, False)}


@router.put("/{event_id}")
def update_event(event_id: int, body: EventIn, db: Session = Depends(get_db), me: User = Depends(require_staff)):
    event = db.get(CommunityEvent, event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    going = db.query(func.count(EventSignup.id)).filter(EventSignup.event_id == event_id).scalar()
    if body.capacity is not None and body.capacity < going:
        raise HTTPException(400, f"{going} people have already joined - capacity cannot be lower than that")
    for field, value in body.model_dump().items():
        setattr(event, field, value)
    db.commit()
    return {"success": True, "event": _out(event, going, False)}


@router.delete("/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db), me: User = Depends(require_staff)):
    event = db.get(CommunityEvent, event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    db.delete(event)
    db.commit()
    return {"success": True, "message": "Event deleted"}


@router.get("/{event_id}/attendees")
def attendees(event_id: int, db: Session = Depends(get_db), me: User = Depends(require_staff)):
    if not db.get(CommunityEvent, event_id):
        raise HTTPException(404, "Event not found")
    rows = (db.query(User).join(EventSignup, EventSignup.user_id == User.id)
            .filter(EventSignup.event_id == event_id).order_by(EventSignup.created_at).all())
    return {"success": True, "attendees": [
        {"id": u.id, "name": u.name, "email": u.email, "phone_number": u.phone_number} for u in rows]}


@router.post("/{event_id}/join")
def join_event(event_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    if is_staff(me):
        raise HTTPException(403, "Staff manage events - they do not join them")
    # Lock the event row so two people cannot take the last spot at the same moment
    event = db.query(CommunityEvent).filter(CommunityEvent.id == event_id).with_for_update().first()
    if not event:
        raise HTTPException(404, "Event not found")
    if (event.ends_at or event.starts_at) < now_colombo():
        raise HTTPException(400, "This event has already taken place")
    if db.query(EventSignup).filter(EventSignup.event_id == event_id, EventSignup.user_id == me.id).first():
        return {"success": True, "message": "You have already joined this event"}
    going = db.query(func.count(EventSignup.id)).filter(EventSignup.event_id == event_id).scalar()
    if event.capacity is not None and going >= event.capacity:
        raise HTTPException(400, "Sorry, this event is full")
    db.add(EventSignup(event_id=event_id, user_id=me.id))
    db.commit()
    return {"success": True, "message": "You have joined the event"}


@router.delete("/{event_id}/join")
def leave_event(event_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    db.query(EventSignup).filter(EventSignup.event_id == event_id, EventSignup.user_id == me.id).delete()
    db.commit()
    return {"success": True, "message": "You have left the event"}


@router.post("/subscribe")
@limiter.limit("5/minute")
def subscribe(request: Request, body: SubscribeRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if not db.query(EventSubscriber).filter(EventSubscriber.email == email).first():
        db.add(EventSubscriber(email=email))
        db.commit()
    # Same answer either way, so the form cannot be used to discover who is subscribed
    return {"success": True, "message": "You're on the list"}
