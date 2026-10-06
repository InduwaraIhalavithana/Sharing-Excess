from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, is_staff
from app.models import FoodListing, FoodRequest, User
from app.schemas import RespondRequest, UpdateDeliveryStatus
from app.utils.email import request_accepted_email, request_declined_email, request_delivered_email, send_email
from app.utils.uploads import save_upload

router = APIRouter(prefix="/api/requests", tags=["requests"])

VALID_STATUSES = {"pending", "accepted", "declined", "quality_checked", "delivering",
                  "delivered", "picked_up", "cancelled"}
RECIPIENT_STATUSES = {"picked_up", "cancelled"}


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
        "feedback_given":    bool(r.feedback),
    }


@router.get("")
def get_requests(
    recipient_id: Optional[int] = None,
    donor_view:   Optional[str] = None,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    q = db.query(FoodRequest)
    if recipient_id:
        # Recipients only ever see their own requests
        if recipient_id != me.id and not is_staff(me):
            raise HTTPException(403, "You can only view your own requests")
        q = q.filter(FoodRequest.recipient_id == recipient_id)
    else:
        # The open board (with recipient contact details) is for donors and staff
        if me.role != "donor" and not is_staff(me):
            raise HTTPException(403, "Only donors can browse open requests")
        if donor_view == "true":
            q = q.filter(FoodRequest.status.in_(["pending", "accepted"]))
        else:
            q = q.filter(FoodRequest.status == "pending")
        if me.role == "donor":
            # Open requests, plus requests made on this donor's own listings
            q = q.outerjoin(FoodListing, FoodRequest.listing_id == FoodListing.id).filter(
                (FoodRequest.listing_id.is_(None)) | (FoodListing.donor_id == me.id)
            )
    requests = q.order_by(FoodRequest.created_at.desc()).all()
    return {"success": True, "requests": [_request_out(r) for r in requests]}


@router.post("")
async def add_request(
    food_name:    str            = Form(...),
    quantity:     str            = Form(...),
    needed_by:    str            = Form(""),
    location:     str            = Form(""),
    description:  str            = Form(""),
    listing_id:   Optional[int]  = Form(None),
    food_image:   Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if me.role != "recipient":
        raise HTTPException(403, "Only recipients can request food")
    recipient_id = me.id

    if listing_id and not db.query(FoodListing).filter(FoodListing.id == listing_id).first():
        raise HTTPException(404, "Listing not found")

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
        listing_id=listing_id,
        image_path=image_path,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"success": True, "message": "Request added successfully", "request": _request_out(req)}


@router.put("/{request_id}/respond")
def respond_to_request(
    request_id: int, body: RespondRequest,
    db: Session = Depends(get_db), me: User = Depends(get_current_user),
):
    if body.status not in ("accepted", "declined"):
        raise HTTPException(400, "status must be 'accepted' or 'declined'")
    if me.role != "donor" and not is_staff(me):
        raise HTTPException(403, "Only donors can respond to requests")

    req = db.query(FoodRequest).filter(FoodRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")
    if req.status != "pending":
        raise HTTPException(400, f"This request is already {req.status}")
    # A request tied to a listing can only be answered by that listing's donor (or staff)
    if req.listing and req.listing.donor_id != me.id and not is_staff(me):
        raise HTTPException(403, "This request is for another donor's listing")
    # Identity comes from the token, never from the request body
    body.user_id = me.id
    body.user_name = me.name

    req.status = body.status
    recipient = req.recipient

    if body.status == "accepted":
        req.accepted_by = body.user_name or None
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
        if recipient and recipient.email:
            send_email(
                recipient.email,
                "Your food request has been accepted – Sharing Excess",
                request_accepted_email(recipient.name, req.food_name,
                                       body.user_name or "a donor", donor_phone),
            )
        return {"success": True, "message": "Request accepted", "donor_phone": donor_phone}

    db.commit()
    if recipient and recipient.email:
        send_email(
            recipient.email,
            "Update on your food request – Sharing Excess",
            request_declined_email(recipient.name, req.food_name),
        )
    return {"success": True, "message": "Request declined"}


@router.put("/{request_id}/status")
def update_delivery_status(
    request_id: int, body: UpdateDeliveryStatus,
    db: Session = Depends(get_db), me: User = Depends(get_current_user),
):
    if body.status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status. Use one of: {', '.join(sorted(VALID_STATUSES))}")
    req = db.query(FoodRequest).filter(FoodRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")
    if not is_staff(me):
        is_owner = req.recipient_id == me.id
        is_donor = me.role == "donor" and (
            (req.listing is not None and req.listing.donor_id == me.id)
            or (req.listing is None and req.accepted_by == me.name)
        )
        if not (is_owner or is_donor):
            raise HTTPException(403, "You are not part of this request")
        if not is_donor and body.status not in RECIPIENT_STATUSES:
            raise HTTPException(403, "Recipients can only mark a request picked up or cancelled")
    prev_status = req.status
    req.status = body.status
    db.commit()
    if body.status == "delivered" and prev_status != "delivered" and req.recipient and req.recipient.email:
        send_email(
            req.recipient.email,
            "Your food has been delivered – Sharing Excess",
            request_delivered_email(req.recipient.name, req.food_name),
        )
    return {"success": True, "message": "Status updated"}


@router.delete("/{request_id}")
def delete_request(request_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    req = db.query(FoodRequest).filter(FoodRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")
    if req.recipient_id != me.id and not is_staff(me):
        raise HTTPException(403, "You can only delete your own requests")
    db.delete(req)
    db.commit()
    return {"success": True, "message": "Request deleted"}
