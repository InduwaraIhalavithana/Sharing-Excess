from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FoodListing, User
from app.schemas import ListingOut, ListingUpdate
from app.utils.uploads import save_upload

router = APIRouter(prefix="/api/listings", tags=["listings"])


def _listing_out(l: FoodListing) -> dict:
    return {
        "id": l.id,
        "donor_id": l.donor_id,
        "food_name": l.food_name,
        "quantity": l.quantity,
        "expiry_date": l.expiry_date,
        "location": l.location,
        "description": l.description,
        "contact_phone": l.contact_phone,
        "contact_email": l.contact_email,
        "image_path": l.image_path,
        "status": l.status,
        "accepted_by": l.accepted_by,
        "requested_by": l.requested_by,
        "created_at": l.created_at.isoformat() if l.created_at else None,
        "donor_name": l.donor.name if l.donor else None,
    }


@router.get("")
def get_listings(
    donor_id: Optional[int] = None,
    q: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    query = db.query(FoodListing)
    if donor_id:
        query = query.filter(FoodListing.donor_id == donor_id)
    else:
        query = query.filter(FoodListing.status == "available")
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
            "listings": [_listing_out(l) for l in listings]}


@router.post("")
async def add_listing(
    donor_id:      int            = Form(...),
    food_name:     str            = Form(...),
    quantity:      str            = Form(...),
    expiry_date:   str            = Form(""),
    location:      str            = Form(""),
    description:   str            = Form(""),
    contact_phone: str            = Form(""),
    contact_email: str            = Form(""),
    food_image:    Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    if not db.query(User).filter(User.id == donor_id).first():
        raise HTTPException(404, "Donor not found")

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
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return {"success": True, "message": "Listing added successfully", "listing": _listing_out(listing)}


@router.delete("/{listing_id}")
def delete_listing(listing_id: int, db: Session = Depends(get_db)):
    listing = db.query(FoodListing).filter(FoodListing.id == listing_id).first()
    if not listing:
        raise HTTPException(404, "Listing not found")
    db.delete(listing)
    db.commit()
    return {"success": True, "message": "Listing deleted"}
