from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, extract
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import User, FoodListing, FoodRequest, MoneyDonation, Feedback
from app.schemas import UserUpdate, ListingUpdate, RequestUpdate
from app.dependencies import require_officer


class FeedbackReply(BaseModel):
    reply: Optional[str] = None

router = APIRouter(prefix="/api/officer", tags=["officer"])


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role != "officer").order_by(User.created_at.desc()).all()
    return {"success": True, "users": [
        {"id": u.id, "name": u.name, "email": u.email,
         "role": u.role, "status": u.status,
         "is_verified": u.status == "active",
         "location": getattr(u, "location", None),
         "created_at": u.created_at}
        for u in users
    ]}


@router.put("/users/{user_id}")
def update_user(user_id: int, body: UserUpdate,
                current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(user, field, val)
    db.commit()
    return {"success": True, "message": "User updated"}


@router.delete("/users/{user_id}")
def delete_user(user_id: int,
                current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    db.delete(user)
    db.commit()
    return {"success": True, "message": "User deleted"}


@router.patch("/users/{user_id}/suspend")
def toggle_suspend(user_id: int,
                   current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.status = "suspended" if user.status == "active" else "active"
    db.commit()
    return {"success": True, "status": user.status}


# ── Listings ──────────────────────────────────────────────────────────────────

@router.get("/listings")
def list_listings(current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    listings = db.query(FoodListing).order_by(FoodListing.created_at.desc()).all()
    return {"success": True, "listings": [
        {
            "id": l.id, "food_name": l.food_name, "description": l.description,
            "quantity": l.quantity, "status": l.status,
            "expiry_date": l.expiry_date, "location": l.location,
            "created_at": l.created_at, "donor_id": l.donor_id,
            "donor_name": l.donor.name if l.donor else None,
        }
        for l in listings
    ]}


@router.put("/listings/{listing_id}")
def update_listing(listing_id: int, body: ListingUpdate,
                   current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    listing = db.query(FoodListing).filter(FoodListing.id == listing_id).first()
    if not listing:
        raise HTTPException(404, "Listing not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(listing, field, val)
    db.commit()
    return {"success": True, "message": "Listing updated"}


@router.delete("/listings/{listing_id}")
def delete_listing(listing_id: int,
                   current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    listing = db.query(FoodListing).filter(FoodListing.id == listing_id).first()
    if not listing:
        raise HTTPException(404, "Listing not found")
    db.delete(listing)
    db.commit()
    return {"success": True, "message": "Listing deleted"}


# ── Requests ──────────────────────────────────────────────────────────────────

@router.get("/requests")
def list_requests(current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    requests = db.query(FoodRequest).order_by(FoodRequest.created_at.desc()).all()
    return {"success": True, "requests": [
        {
            "id": r.id, "food_item": r.food_name, "quantity": r.quantity,
            "needed_by": r.needed_by, "location": r.location,
            "status": r.status, "accepted_by": r.accepted_by,
            "created_at": r.created_at,
            "recipient_name": r.recipient.name if r.recipient else None,
            "recipient_email": r.recipient.email if r.recipient else None,
        }
        for r in requests
    ]}


@router.put("/requests/{request_id}")
def update_request(request_id: int, body: RequestUpdate,
                   current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    req = db.query(FoodRequest).filter(FoodRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(req, field, val)
    db.commit()
    return {"success": True, "message": "Request updated"}


@router.delete("/requests/{request_id}")
def delete_request(request_id: int,
                   current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    req = db.query(FoodRequest).filter(FoodRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")
    db.delete(req)
    db.commit()
    return {"success": True, "message": "Request deleted"}


# ── Money donations ───────────────────────────────────────────────────────────

@router.get("/donations/money")
def list_money_donations(current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    donations = db.query(MoneyDonation).order_by(MoneyDonation.created_at.desc()).all()
    return {"success": True, "donations": [
        {"id": d.id, "name": d.name, "email": d.email,
         "amount": float(d.amount), "card_last4": d.card_last4,
         "created_at": d.created_at}
        for d in donations
    ]}


# ── Feedback management ───────────────────────────────────────────────────────

@router.get("/feedback")
def list_feedback(current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    rows = db.query(Feedback).order_by(Feedback.created_at.desc()).all()
    return {"success": True, "feedback": [
        {
            "id":               f.id,
            "request_id":       f.request_id,
            "recipient_id":     f.recipient_id,
            "recipient_name":   f.recipient.name if f.recipient else "Anonymous",
            "rating":           f.rating,
            "comment":          f.comment,
            "image_path":       f.image_path,
            "admin_reply":      f.admin_reply,
            "feedback_status":  f.feedback_status,
            "created_at":       f.created_at,
        }
        for f in rows
    ]}


@router.post("/feedback/{feedback_id}/resolve")
def resolve_feedback(feedback_id: int, body: FeedbackReply,
                     current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    fb = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(404, "Feedback not found")
    fb.admin_reply = body.reply or ""
    fb.feedback_status = "resolved"
    db.commit()
    return {"success": True, "message": "Feedback resolved"}


@router.patch("/feedback/{feedback_id}/reopen")
def reopen_feedback(feedback_id: int,
                    current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    fb = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(404, "Feedback not found")
    fb.feedback_status = "open"
    fb.admin_reply = None
    db.commit()
    return {"success": True, "message": "Feedback reopened"}


# ── Stats (officer dashboard charts) ─────────────────────────────────────────

@router.get("/stats")
def get_stats(current_user: User = Depends(require_officer), db: Session = Depends(get_db)):
    total_requests  = db.query(FoodRequest).count()
    total_listings  = db.query(FoodListing).count()
    total_users     = db.query(User).count()
    total_donations = db.query(MoneyDonation).count()

    req_by_status = dict(
        db.query(FoodRequest.status, func.count(FoodRequest.id))
          .group_by(FoodRequest.status).all()
    )
    users_by_role = dict(
        db.query(User.role, func.count(User.id))
          .group_by(User.role).all()
    )
    top_foods = (
        db.query(FoodRequest.food_name, func.count(FoodRequest.id).label("count"))
          .group_by(FoodRequest.food_name)
          .order_by(func.count(FoodRequest.id).desc())
          .limit(5).all()
    )
    donations_by_month = (
        db.query(
            extract("year",  FoodRequest.created_at).label("year"),
            extract("month", FoodRequest.created_at).label("month"),
            func.count(FoodRequest.id).label("count"),
        )
        .filter(FoodRequest.status == "accepted")
        .group_by("year", "month")
        .order_by("year", "month")
        .limit(6).all()
    )

    return {
        "success": True,
        "total_requests":        total_requests,
        "total_listings":        total_listings,
        "total_users":           total_users,
        "total_money_donations": total_donations,
        "requests_by_status":    req_by_status,
        "users_by_role":         users_by_role,
        "top_requested_foods":   [{"name": f[0], "count": f[1]} for f in top_foods],
        "donations_by_month":    [{"year": int(d[0]), "month": int(d[1]), "count": d[2]}
                                   for d in donations_by_month],
    }
