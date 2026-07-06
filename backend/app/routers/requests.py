from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FoodRequest, FoodListing, User
from app.schemas import RespondRequest, UpdateDeliveryStatus
from app.utils.uploads import save_upload

router = APIRouter(prefix="/api/requests", tags=["requests"])


def _request_out(r: FoodRequest) -> dict:
    donor_id    = None
    donor_name  = None
    donor_phone = None
    if r.listing and r.listing.donor:
        donor_id    = r.listing.donor_id
        donor_name  = r.listing.donor.name
        donor_phone = r.listing.donor.phone_number
    elif r.accepted_by:
        donor_name = r.accepted_by

    return {
        "id":                r.id,
        "recipient_id":      r.recipient_id,
        "food_item":         r.food_name,   # frontend expects "food_item"
        "quantity":          r.quantity,
        "needed_by":         r.needed_by,
        "location":          r.location,
        "description":       r.description,
        "image_path":        r.image_path,
        "listing_id":        r.listing_id,
        "status":            r.status,
        "accepted_by":       r.accepted_by,
        "created_at":        r.created_at.isoformat() if r.created_at else None,
        "recipient_name":    r.recipient.name     if r.recipient else None,
        "recipient_email":   r.recipient.email    if r.recipient else None,
        "recipient_phone":   r.recipient.phone_number if r.recipient else None,
        "recipient_location": r.recipient.location if r.recipient else None,
        "donor_id":          donor_id,
        "donor_name":        donor_name,
        "donor_phone":       donor_phone,
    }


@router.get("")
def get_requests(
    recipient_id: Optional[int] = None,
    donor_view:   Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(FoodRequest)
    if recipient_id:
        q = q.filter(FoodRequest.recipient_id == recipient_id)
    elif donor_view == "true":
        q = q.filter(FoodRequest.status.in_(["pending", "accepted"]))
    else:
        q = q.filter(FoodRequest.status == "pending")
    requests = q.order_by(FoodRequest.created_at.desc()).all()
    return {"success": True, "requests": [_request_out(r) for r in requests]}


@router.post("")
async def add_request(
    recipient_id: int            = Form(...),
    food_name:    str            = Form(...),
    quantity:     str            = Form(...),
    needed_by:    str            = Form(""),
    location:     str            = Form(""),
    description:  str            = Form(""),
    food_image:   Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    if not db.query(User).filter(User.id == recipient_id).first():
        raise HTTPException(404, "Recipient not found")

    image_path = None
    if food_image and food_image.filename:
        image_path = await save_upload(food_image, prefix="request")

    req = FoodRequest(
        recipient_id=recipient_id,
        food_name=food_name,
        quantity=quantity,
        needed_by=needed_by or None,
        location=location or None,
        description=description or None,
        image_path=image_path,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"success": True, "message": "Request added successfully", "request": _request_out(req)}


@router.put("/{request_id}/respond")
def respond_to_request(request_id: int, body: RespondRequest, db: Session = Depends(get_db)):
    if body.status not in ("accepted", "declined"):
        raise HTTPException(400, "status must be 'accepted' or 'declined'")

    req = db.query(FoodRequest).filter(FoodRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")

    req.status = body.status

    if body.status == "accepted":
        req.accepted_by = body.user_name or None
        # Also mark the linked listing as accepted
        if req.listing_id:
            listing = db.query(FoodListing).filter(FoodListing.id == req.listing_id).first()
            if listing:
                listing.status = "accepted"
                listing.accepted_by = body.user_name or None

        donor_phone = ""
        if body.user_id:
            donor = db.query(User).filter(User.id == body.user_id).first()
            donor_phone = donor.phone_number or "" if donor else ""

        db.commit()
        return {"success": True, "message": "Request accepted", "donor_phone": donor_phone}

    db.commit()
    return {"success": True, "message": "Request declined"}


@router.put("/{request_id}/status")
def update_delivery_status(request_id: int, body: UpdateDeliveryStatus, db: Session = Depends(get_db)):
    req = db.query(FoodRequest).filter(FoodRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")
    req.status = body.status
    db.commit()
    return {"success": True, "message": "Status updated"}


@router.delete("/{request_id}")
def delete_request(request_id: int, db: Session = Depends(get_db)):
    req = db.query(FoodRequest).filter(FoodRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")
    db.delete(req)
    db.commit()
    return {"success": True, "message": "Request deleted"}
