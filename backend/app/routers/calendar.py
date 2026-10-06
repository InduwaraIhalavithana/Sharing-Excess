from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, is_staff
from app.models import FoodRequest, FoodListing, User

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("/events")
def get_calendar_events(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    events = []

    def person(u, *party_ids):
        """Contact details are shown only to staff, to the person themself, or to the
        other side of the same food exchange - never to every logged-in user."""
        if not u:
            return None
        visible = is_staff(me) or me.id == u.id or me.id in party_ids
        return {
            "id": u.id,
            "name": u.name,
            "email": u.email if visible else None,
            "phone": u.phone_number if visible else None,
        }

    # Food requests
    requests = db.query(FoodRequest).order_by(FoodRequest.needed_by.asc()).all()
    for r in requests:
        donor = person(r.listing.donor, r.recipient_id) if r.listing and r.listing.donor else None
        events.append({
            "id":       f"req_{r.id}",
            "title":    r.food_name,
            "date":     r.needed_by,
            "quantity": r.quantity,
            "type":     "request",
            "status":   r.status,
            "location": r.location,
            "recipient": person(r.recipient, r.listing.donor_id if r.listing else None),
            "donor": donor,
        })

    # Food listings (available / reserved / picked_up)
    listings = (
        db.query(FoodListing)
          .filter(FoodListing.status.in_(["available", "reserved", "picked_up"]))
          .order_by(FoodListing.expiry_date.asc())
          .all()
    )
    for l in listings:
        recipient = None
        if l.requests:
            req = l.requests[0]
            if req.recipient:
                recipient = person(req.recipient, l.donor_id)
        events.append({
            "id":       f"list_{l.id}",
            "title":    l.food_name,
            "date":     l.expiry_date,
            "quantity": l.quantity,
            "type":     "listing",
            "status":   l.status,
            "notes":    l.description,
            "location": l.location,
            "donor": person(l.donor, l.requests[0].recipient_id if l.requests else None),
            "recipient": recipient,
        })

    # Sort all events by date
    events.sort(key=lambda e: (e["date"] or "9999-12-31"))

    return {
        "success": True,
        "events": events,
        "counts": {
            "total":    len(events),
            "requests": len(requests),
            "listings": len(listings),
        },
    }
