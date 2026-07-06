from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FoodRequest, FoodListing

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("/events")
def get_calendar_events(db: Session = Depends(get_db)):
    events = []

    # Food requests
    requests = db.query(FoodRequest).order_by(FoodRequest.needed_by.asc()).all()
    for r in requests:
        donor = None
        if r.listing and r.listing.donor:
            d = r.listing.donor
            donor = {"id": d.id, "name": d.name, "email": d.email, "phone": d.phone_number}
        events.append({
            "id":       f"req_{r.id}",
            "title":    r.food_name,
            "date":     r.needed_by,
            "quantity": r.quantity,
            "type":     "request",
            "status":   r.status,
            "location": r.location,
            "recipient": {
                "id":    r.recipient.id    if r.recipient else None,
                "name":  r.recipient.name  if r.recipient else None,
                "email": r.recipient.email if r.recipient else None,
                "phone": r.recipient.phone_number if r.recipient else None,
            } if r.recipient else None,
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
                rec = req.recipient
                recipient = {"id": rec.id, "name": rec.name, "email": rec.email, "phone": rec.phone_number}
        events.append({
            "id":       f"list_{l.id}",
            "title":    l.food_name,
            "date":     l.expiry_date,
            "quantity": l.quantity,
            "type":     "listing",
            "status":   l.status,
            "notes":    l.description,
            "location": l.location,
            "donor": {
                "id":    l.donor.id    if l.donor else None,
                "name":  l.donor.name  if l.donor else None,
                "email": l.donor.email if l.donor else None,
                "phone": l.donor.phone_number if l.donor else None,
            } if l.donor else None,
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
