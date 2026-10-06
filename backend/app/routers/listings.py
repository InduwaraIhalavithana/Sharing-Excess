from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, is_staff, optional_user, require_roles
from app.models import FoodListing, User
from app.utils.uploads import save_upload

router = APIRouter(prefix="/api/listings", tags=["listings"])


def _listing_out(item: FoodListing, private: bool = False) -> dict:
    """`private` (the donor themself, or staff) adds the donor's phone and email; everyone else never gets them."""
    return {
        "id": item.id,
        "donor_id": item.donor_id,
        "food_name": item.food_name,
        "quantity": item.quantity,
        "expiry_date": item.expiry_date,
        "location": item.location,
        "description": item.description,
        "contact_phone": item.contact_phone if private else None,
        "contact_email": item.contact_email if private else None,
        "image_path": item.image_path,
        "status": item.status,
        "verification_status": item.verification_status,
        "rejection_reason": item.rejection_reason,
        "accepted_by": item.accepted_by,
        "requested_by": item.requested_by,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "donor_name": item.donor.name if item.donor else None,
    }


@router.get("")
def get_listings(
    donor_id: Optional[int] = None,
    q: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    me: Optional[User] = Depends(optional_user),
):
    query = db.query(FoodListing)
    if donor_id:
        # Unreviewed / rejected listings are visible only to their owner and staff
        if me is None:
            raise HTTPException(401, "Not authenticated")
        if me.id != donor_id and not is_staff(me):
            raise HTTPException(403, "You can only view your own listings")
        # Donors see all their own listings, whatever the verification state
        query = query.filter(FoodListing.donor_id == donor_id)
    else:
        # Public browse shows only officer-approved, available listings
        query = query.filter(
            FoodListing.status == "available",
            FoodListing.verification_status == "approved",
        )
    if q:
        like = f"%{q}%"
        query = query.filter(
            FoodListing.food_name.ilike(like) |
            FoodListing.description.ilike(like) |
            FoodListing.location.ilike(like)
        )
    total = query.count()
    offset = (max(page, 1) - 1) * limit
    listings = query.order_by(FoodListing.created_at.desc()).offset(offset).limit(limit).all()
    return {"success": True, "total": total, "page": page, "limit": limit,
            "listings": [
                _listing_out(item, private=bool(me and (is_staff(me) or me.id == item.donor_id)))
                for item in listings]}


@router.post("")
async def add_listing(
    food_name:     str            = Form(...),
    quantity:      str            = Form(...),
    expiry_date:   str            = Form(""),
    location:      str            = Form(""),
    description:   str            = Form(""),
    contact_phone: str            = Form(""),
    contact_email: str            = Form(""),
    food_image:    Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    me: User = Depends(require_roles("donor")),
):
    donor_id = me.id

    image_path = None
    if food_image and food_image.filename:
        image_path = await save_upload(food_image, prefix="listing")

    listing = FoodListing(
        donor_id=donor_id,
        food_name=food_name,
        quantity=quantity,
        expiry_date=expiry_date or None,
        location=location or None,
        description=description or None,
        contact_phone=contact_phone or None,
        contact_email=contact_email or None,
        image_path=image_path,
        status="available",
        verification_status="pending_review",
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return {"success": True,
            "message": "Listing submitted — it will appear publicly once an officer approves it",
            "listing": _listing_out(listing, private=True)}


@router.delete("/{listing_id}")
def delete_listing(listing_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    listing = db.query(FoodListing).filter(FoodListing.id == listing_id).first()
    if not listing:
        raise HTTPException(404, "Listing not found")
    if listing.donor_id != me.id and not is_staff(me):
        raise HTTPException(403, "You can only delete your own listings")
    db.delete(listing)
    db.commit()
    return {"success": True, "message": "Listing deleted"}
