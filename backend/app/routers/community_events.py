"""Community events (food drives, volunteer sessions, distributions): approved NGOs publish them, anyone can browse,
signed-in users can join, and users in the event's district (plus email subscribers) hear about new ones."""
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.constants import EVENT_TYPES
from app.database import get_db
from app.dependencies import get_current_user, is_admin, optional_user, require_approved_ngo
from app.models import CommunityEvent, EventSignup, EventSubscriber, User
from app.schemas import EventIn, SubscribeRequest
from app.services.notifications import announce_event
from app.utils.limiter import limiter
from app.utils.params import district_list
from app.utils.timeutil import now_colombo
from app.utils.uploads import delete_upload, save_upload

router = APIRouter(prefix="/api/community-events", tags=["events"])

MAX_IMAGES = 3


def _out(e: CommunityEvent, going: int, joined: bool) -> dict:
    end = e.ends_at or e.starts_at
    spots_left = None if e.capacity is None else max(e.capacity - going, 0)
    owner = e.owner
    return {
        "id": e.id,
        "title": e.title,
        "description": e.description,
        "event_type": e.event_type,
        "location": e.location,
        "district": e.district,
        "starts_at": e.starts_at.isoformat(),
        "ends_at": e.ends_at.isoformat() if e.ends_at else None,
        "capacity": e.capacity,
        "going": going,
        "spots_left": spots_left,
        "full": spots_left == 0,
        "is_past": end < now_colombo(),
        "joined": joined,
        "images": list(e.images or []),
        "status": e.status,
        "contact": {"name": e.contact_name, "phone": e.contact_phone, "email": e.contact_email},
        "organiser": {"id": owner.id, "name": owner.org_name or owner.name, "logo": owner.org_logo} if owner else None,
        "owner_id": e.owner_id,
    }


def _counts(db: Session) -> dict[int, int]:
    return dict(db.query(EventSignup.event_id, func.count(EventSignup.id)).group_by(EventSignup.event_id).all())


@router.get("")
def list_events(
    event_type: Optional[str] = None,
    district: Optional[str] = None,
    upcoming: bool = False,
    owner_id: Optional[int] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    me: Optional[User] = Depends(optional_user),
):
    query = db.query(CommunityEvent)
    if event_type:
        if event_type not in EVENT_TYPES:
            raise HTTPException(400, "Unknown event type")
        query = query.filter(CommunityEvent.event_type == event_type)
    if district:
        query = query.filter(CommunityEvent.district.in_(district_list(district)))
    if owner_id:
        query = query.filter(CommunityEvent.owner_id == owner_id)
    if upcoming:
        query = query.filter(func.coalesce(CommunityEvent.ends_at, CommunityEvent.starts_at) >= now_colombo(),
                             CommunityEvent.status == "published")
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(CommunityEvent.title.ilike(like) | CommunityEvent.description.ilike(like)
                             | CommunityEvent.location.ilike(like))
    counts = _counts(db)
    mine = {s.event_id for s in db.query(EventSignup).filter(EventSignup.user_id == me.id)} if me else set()
    events = query.order_by(CommunityEvent.starts_at.asc()).limit(500).all()
    return {"success": True, "events": [_out(e, counts.get(e.id, 0), e.id in mine) for e in events]}


@router.get("/{event_id}")
def get_event(event_id: int, db: Session = Depends(get_db), me: Optional[User] = Depends(optional_user)):
    e = db.get(CommunityEvent, event_id)
    if not e:
        raise HTTPException(404, "Event not found")
    going = db.query(func.count(EventSignup.id)).filter(EventSignup.event_id == event_id).scalar()
    joined = bool(me and db.query(EventSignup).filter(EventSignup.event_id == event_id, EventSignup.user_id == me.id).first())
    return {"success": True, "event": _out(e, going, joined)}


def _own_event(db: Session, event_id: int, me: User) -> CommunityEvent:
    e = db.get(CommunityEvent, event_id)
    if not e:
        raise HTTPException(404, "Event not found")
    if e.owner_id != me.id:
        raise HTTPException(403, "You can only change your own events")
    return e


@router.post("")
def create_event(body: EventIn, background: BackgroundTasks, db: Session = Depends(get_db),
                 me: User = Depends(require_approved_ngo)):
    if body.starts_at <= now_colombo():
        raise HTTPException(400, "The event must start in the future")
    event = CommunityEvent(owner_id=me.id, **body.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    emails = [s.email for s in db.query(EventSubscriber).limit(500)]
    background.add_task(announce_event, event.id, emails)
    return {"success": True, "event": _out(event, 0, False)}


@router.put("/{event_id}")
def update_event(event_id: int, body: EventIn, db: Session = Depends(get_db),
                 me: User = Depends(require_approved_ngo)):
    event = _own_event(db, event_id, me)
    if body.starts_at != event.starts_at and body.starts_at <= now_colombo():
        raise HTTPException(400, "The event must start in the future")
    going = db.query(func.count(EventSignup.id)).filter(EventSignup.event_id == event_id).scalar()
    if body.capacity is not None and body.capacity < going:
        raise HTTPException(400, f"{going} people have already joined - capacity cannot be lower than that")
    for field, value in body.model_dump().items():
        setattr(event, field, value)
    db.commit()
    return {"success": True, "event": _out(event, going, False)}


@router.post("/{event_id}/cancel")
def cancel_event(event_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """The organiser (or the admin, as moderation) cancels an event; it stays listed as cancelled."""
    event = db.get(CommunityEvent, event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    if event.owner_id != me.id and not is_admin(me):
        raise HTTPException(403, "You can only cancel your own events")
    event.status = "cancelled"
    db.commit()
    return {"success": True, "message": "Event cancelled"}


@router.delete("/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    event = db.get(CommunityEvent, event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    if event.owner_id != me.id and not is_admin(me):
        raise HTTPException(403, "You can only delete your own events")
    photos = list(event.images or [])
    db.delete(event)
    db.commit()
    for url in photos:
        delete_upload(url)
    return {"success": True, "message": "Event deleted"}


@router.post("/{event_id}/images")
async def add_image(event_id: int, image: UploadFile = File(...), db: Session = Depends(get_db),
                    me: User = Depends(require_approved_ngo)):
    event = _own_event(db, event_id, me)
    if len(event.images or []) >= MAX_IMAGES:
        raise HTTPException(400, f"An event can have up to {MAX_IMAGES} photos")
    url = await save_upload(image, prefix="event")
    event.images = [*(event.images or []), url]
    db.commit()
    return {"success": True, "images": list(event.images)}


@router.delete("/{event_id}/images")
def remove_image(event_id: int, url: str, db: Session = Depends(get_db), me: User = Depends(require_approved_ngo)):
    event = _own_event(db, event_id, me)
    if url not in (event.images or []):
        raise HTTPException(404, "That photo is not on this event")
    event.images = [u for u in event.images if u != url]
    db.commit()
    delete_upload(url)
    return {"success": True, "images": list(event.images)}


@router.get("/{event_id}/attendees")
def attendees(event_id: int, db: Session = Depends(get_db), me: User = Depends(require_approved_ngo)):
    _own_event(db, event_id, me)
    rows = (db.query(User).join(EventSignup, EventSignup.user_id == User.id)
            .filter(EventSignup.event_id == event_id).order_by(EventSignup.created_at).all())
    return {"success": True, "attendees": [
        {"id": u.id, "name": u.name, "email": u.email, "phone_number": u.phone_number} for u in rows]}


@router.post("/{event_id}/join")
def join_event(event_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    if is_admin(me):
        raise HTTPException(403, "The admin moderates events - they do not join them")
    # Lock the event row so two people cannot take the last spot at the same moment
    event = db.query(CommunityEvent).filter(CommunityEvent.id == event_id).with_for_update().first()
    if not event:
        raise HTTPException(404, "Event not found")
    if event.status != "published":
        raise HTTPException(400, "This event was cancelled")
    if event.owner_id == me.id:
        raise HTTPException(400, "You are the organiser of this event")
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
