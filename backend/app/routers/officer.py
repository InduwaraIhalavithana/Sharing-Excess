from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, extract
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import User, FoodListing, FoodRequest, MoneyDonation, Feedback, Escalation
from app.schemas import UserUpdate, ListingUpdate, RequestUpdate
from app.dependencies import require_staff, require_admin


class FeedbackReply(BaseModel):
    reply: Optional[str] = None


class VerifyListingBody(BaseModel):
    action: str                       # "approve" | "reject"
    reason: Optional[str] = None      # required when rejecting


class EscalationCreate(BaseModel):
    target_type: str                  # "user" | "listing" | "request" | "feedback"
    target_id: int
    reason: str


class EscalationUpdate(BaseModel):
    status: str                       # "actioned" | "dismissed"
    admin_note: Optional[str] = None


router = APIRouter(prefix="/api/officer", tags=["officer"])


# ── Users (ADMIN only) ────────────────────────────────────────────────────────

@router.get("/users")
def list_users(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role.notin_(["admin"])).order_by(User.created_at.desc()).all()
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
                current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(user, field, val)
    db.commit()
    return {"success": True, "message": "User updated"}


@router.delete("/users/{user_id}")
def delete_user(user_id: int,
                current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.role == "admin":
        raise HTTPException(403, "Admin accounts cannot be deleted")
    db.delete(user)
    db.commit()
    return {"success": True, "message": "User deleted"}


@router.patch("/users/{user_id}/suspend")
def toggle_suspend(user_id: int,
                   current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.role == "admin":
        raise HTTPException(403, "Admin accounts cannot be suspended")
    user.status = "suspended" if user.status == "active" else "active"
    db.commit()
    return {"success": True, "status": user.status}


# ── Listings (view: STAFF · verify: STAFF · edit/delete: ADMIN) ──────────────

@router.get("/listings")
def list_listings(current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    listings = db.query(FoodListing).order_by(FoodListing.created_at.desc()).all()
    return {"success": True, "listings": [
        {
            "id": l.id, "food_name": l.food_name, "description": l.description,
            "quantity": l.quantity, "status": l.status,
            "verification_status": l.verification_status,
            "rejection_reason": l.rejection_reason,
            "expiry_date": l.expiry_date, "location": l.location,
            "created_at": l.created_at, "donor_id": l.donor_id,
            "donor_name": l.donor.name if l.donor else None,
        }
        for l in listings
    ]}


@router.get("/listings/pending")
def pending_listings(current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    listings = (db.query(FoodListing)
                  .filter(FoodListing.verification_status == "pending_review")
                  .order_by(FoodListing.created_at.asc()).all())
    return {"success": True, "listings": [
        {
            "id": l.id, "food_name": l.food_name, "description": l.description,
            "quantity": l.quantity, "expiry_date": l.expiry_date,
            "location": l.location, "image_path": l.image_path,
            "created_at": l.created_at,
            "donor_name": l.donor.name if l.donor else None,
            "donor_email": l.donor.email if l.donor else None,
            "contact_phone": l.contact_phone,
        }
        for l in listings
    ]}


@router.patch("/listings/{listing_id}/verify")
def verify_listing(listing_id: int, body: VerifyListingBody,
                   current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    if body.action not in ("approve", "reject"):
        raise HTTPException(400, "action must be 'approve' or 'reject'")
    listing = db.query(FoodListing).filter(FoodListing.id == listing_id).first()
    if not listing:
        raise HTTPException(404, "Listing not found")
    if body.action == "approve":
        listing.verification_status = "approved"
        listing.rejection_reason = None
    else:
        if not (body.reason or "").strip():
            raise HTTPException(400, "A reason is required when rejecting a listing")
        listing.verification_status = "rejected"
        listing.rejection_reason = body.reason.strip()
    db.commit()
    return {"success": True, "verification_status": listing.verification_status}


@router.put("/listings/{listing_id}")
def update_listing(listing_id: int, body: ListingUpdate,
                   current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    listing = db.query(FoodListing).filter(FoodListing.id == listing_id).first()
    if not listing:
        raise HTTPException(404, "Listing not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(listing, field, val)
    db.commit()
    return {"success": True, "message": "Listing updated"}


@router.delete("/listings/{listing_id}")
def delete_listing(listing_id: int,
                   current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    listing = db.query(FoodListing).filter(FoodListing.id == listing_id).first()
    if not listing:
        raise HTTPException(404, "Listing not found")
    db.delete(listing)
    db.commit()
    return {"success": True, "message": "Listing deleted"}


# ── Requests (view/coordinate: STAFF · delete: ADMIN) ────────────────────────

@router.get("/requests")
def list_requests(current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
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
                   current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    req = db.query(FoodRequest).filter(FoodRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(req, field, val)
    db.commit()
    return {"success": True, "message": "Request updated"}


@router.delete("/requests/{request_id}")
def delete_request(request_id: int,
                   current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    req = db.query(FoodRequest).filter(FoodRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")
    db.delete(req)
    db.commit()
    return {"success": True, "message": "Request deleted"}


# ── Money donations (ADMIN only — financial data) ────────────────────────────

@router.get("/donations/money")
def list_money_donations(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    donations = db.query(MoneyDonation).order_by(MoneyDonation.created_at.desc()).all()
    return {"success": True, "donations": [
        {"id": d.id, "name": d.name, "email": d.email,
         "amount": float(d.amount), "card_last4": d.card_last4,
         "created_at": d.created_at}
        for d in donations
    ]}


# ── Feedback (list/resolve/reopen: STAFF · delete: ADMIN) ────────────────────

@router.get("/feedback")
def list_feedback(current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
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
                     current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    fb = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(404, "Feedback not found")
    fb.admin_reply = body.reply or ""
    fb.feedback_status = "resolved"
    db.commit()
    return {"success": True, "message": "Feedback resolved"}


@router.patch("/feedback/{feedback_id}/reopen")
def reopen_feedback(feedback_id: int,
                    current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    fb = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(404, "Feedback not found")
    fb.feedback_status = "open"
    fb.admin_reply = None
    db.commit()
    return {"success": True, "message": "Feedback reopened"}


@router.delete("/feedback/{feedback_id}")
def delete_feedback(feedback_id: int,
                    current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    fb = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(404, "Feedback not found")
    db.delete(fb)
    db.commit()
    return {"success": True, "message": "Feedback deleted"}


# ── Escalations (create/list: STAFF · action: ADMIN) ─────────────────────────

@router.post("/escalations")
def create_escalation(body: EscalationCreate,
                      current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    if body.target_type not in ("user", "listing", "request", "feedback"):
        raise HTTPException(400, "Invalid target_type")
    if not body.reason.strip():
        raise HTTPException(400, "A reason is required")
    esc = Escalation(
        raised_by=current_user.id,
        target_type=body.target_type,
        target_id=body.target_id,
        reason=body.reason.strip(),
    )
    db.add(esc)
    db.commit()
    db.refresh(esc)
    return {"success": True, "message": "Escalated to admin", "escalation_id": esc.id}


@router.get("/escalations")
def list_escalations(current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    q = db.query(Escalation)
    # Officers see only their own flags; admin sees the full inbox
    if current_user.role != "admin":
        q = q.filter(Escalation.raised_by == current_user.id)
    rows = q.order_by(Escalation.created_at.desc()).all()
    return {"success": True, "escalations": [
        {
            "id": e.id,
            "raised_by": e.raised_by,
            "officer_name": e.officer.name if e.officer else None,
            "target_type": e.target_type,
            "target_id": e.target_id,
            "reason": e.reason,
            "status": e.status,
            "admin_note": e.admin_note,
            "created_at": e.created_at,
        }
        for e in rows
    ]}


@router.patch("/escalations/{escalation_id}")
def update_escalation(escalation_id: int, body: EscalationUpdate,
                      current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    if body.status not in ("actioned", "dismissed", "open"):
        raise HTTPException(400, "status must be 'actioned', 'dismissed' or 'open'")
    esc = db.query(Escalation).filter(Escalation.id == escalation_id).first()
    if not esc:
        raise HTTPException(404, "Escalation not found")
    esc.status = body.status
    if body.admin_note is not None:
        esc.admin_note = body.admin_note
    db.commit()
    return {"success": True, "message": "Escalation updated"}


# ── Stats (STAFF — financial figures stripped for non-admin) ─────────────────

@router.get("/stats")
def get_stats(current_user: User = Depends(require_staff), db: Session = Depends(get_db)):
    total_requests  = db.query(FoodRequest).count()
    total_listings  = db.query(FoodListing).count()
    total_users     = db.query(User).count()
    pending_verifications = (db.query(FoodListing)
                               .filter(FoodListing.verification_status == "pending_review").count())
    open_escalations = db.query(Escalation).filter(Escalation.status == "open").count()

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

    out = {
        "success": True,
        "total_requests":        total_requests,
        "total_listings":        total_listings,
        "total_users":           total_users,
        "pending_verifications": pending_verifications,
        "open_escalations":      open_escalations,
        "requests_by_status":    req_by_status,
        "users_by_role":         users_by_role,
        "top_requested_foods":   [{"name": f[0], "count": f[1]} for f in top_foods],
        "donations_by_month":    [{"year": int(d[0]), "month": int(d[1]), "count": d[2]}
                                   for d in donations_by_month],
    }
    # Financial data is admin-only
    if current_user.role == "admin":
        out["total_money_donations"] = db.query(MoneyDonation).count()
    return out
