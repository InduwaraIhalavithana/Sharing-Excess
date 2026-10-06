"""Anonymous, counts-only endpoints for the public home page."""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FoodListing, FoodRequest, User

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    """Aggregate numbers only - no names, contact details or individual records."""
    listings = db.query(func.count(FoodListing.id)).filter(
        FoodListing.status == "available", FoodListing.verification_status == "approved"
    ).scalar()
    open_requests = db.query(func.count(FoodRequest.id)).filter(FoodRequest.status == "pending").scalar()
    delivered = db.query(func.count(FoodRequest.id)).filter(FoodRequest.status == "delivered").scalar()
    donors = db.query(func.count(User.id)).filter(User.role == "donor", User.status == "active").scalar()
    recipients = db.query(func.count(User.id)).filter(User.role == "recipient", User.status == "active").scalar()
    return {
        "success": True,
        "listings_available": listings,
        "requests_open": open_requests,
        "meals_delivered": delivered,
        "donors": donors,
        "recipients": recipients,
    }
