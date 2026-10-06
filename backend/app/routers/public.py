"""Anonymous, counts-only endpoints for the public home page."""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CommunityEvent, FoodListing, FoodRequest, User
from app.utils.timeutil import now_colombo

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    """Aggregate numbers only - no names, contact details or individual records."""
    now = now_colombo()

    def active_users(role: str, *extra):
        return db.query(func.count(User.id)).filter(User.role == role, User.status == "active", *extra).scalar()

    return {
        "success": True,
        "listings_available": db.query(func.count(FoodListing.id)).filter(
            FoodListing.status == "active", FoodListing.expires_at > now).scalar(),
        "requests_open": db.query(func.count(FoodRequest.id)).filter(FoodRequest.status == "pending").scalar(),
        "handovers_completed": db.query(func.count(FoodRequest.id)).filter(FoodRequest.status == "completed").scalar(),
        "listings_shared": db.query(func.count(FoodListing.id)).scalar(),
        "districts_covered": db.query(func.count(func.distinct(FoodListing.district))).scalar(),
        "donors": active_users("donor"),
        "recipients": active_users("recipient"),
        "ngos": active_users("ngo", User.ngo_status == "approved"),
        "events_upcoming": db.query(func.count(CommunityEvent.id)).filter(
            CommunityEvent.status == "published", CommunityEvent.starts_at >= now).scalar(),
    }
