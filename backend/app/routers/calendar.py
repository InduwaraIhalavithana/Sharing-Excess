from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, is_staff
from app.models import FoodListing, FoodRequest, User

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
    for item in listings:
        recipient = None
        if item.requests:
            req = item.requests[0]
            if req.recipient:
                recipient = person(req.recipient, item.donor_id)
        events.append({
            "id":       f"list_{item.id}",
            "title":    item.food_name,
            "date":     item.expiry_date,
            "quantity": item.quantity,
            "type":     "listing",
            "status":   item.status,
            "notes":    item.description,
            "location": item.location,
            "donor": person(item.donor, item.requests[0].recipient_id if item.requests else None),
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
