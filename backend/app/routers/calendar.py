from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import FoodListing, FoodRequest, User

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("/events")
def get_calendar_events(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """The signed-in user's own food on a timeline: donors see their listings, recipients and NGOs their requests.
    Nobody's contact details appear here - those live on the request, after acceptance."""
    items = []
    if me.role == "donor":
        for x in db.query(FoodListing).filter(FoodListing.donor_id == me.id).all():
            items.append({"id": f"list_{x.id}", "type": "listing", "title": x.food_name, "date": x.expires_at.isoformat(),
                          "quantity": f"{x.quantity_available:g}/{x.quantity_total:g} {x.unit}", "status": x.status,
                          "location": x.area or x.district})
    elif me.role in ("recipient", "ngo"):
        for r in db.query(FoodRequest).filter(FoodRequest.recipient_id == me.id).all():
            items.append({"id": f"req_{r.id}", "type": "request", "title": r.listing.food_name,
                          "date": r.listing.expires_at.isoformat(), "quantity": f"{r.quantity_requested:g} {r.listing.unit}",
                          "status": r.status, "location": r.listing.area or r.listing.district})
    items.sort(key=lambda e: e["date"])
    return {"success": True, "events": items, "counts": {"total": len(items)}}
