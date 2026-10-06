"""The single admin account: user and NGO management, moderation (listings, events, reports), platform feedback, stats.

The admin does NOT check food quality or supervise handovers - listings go live on their own.
"""
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models import (
    CommunityEvent,
    Feedback,
    FoodListing,
    FoodRequest,
    Report,
    User,
)
from app.routers.listings import close_listing
from app.schemas import FeedbackReply, ReasonBody, ReportUpdate, UserUpdate
from app.services import stock
from app.services.accounts import purge_user
from app.services.notifications import notify, schedule_emails
from app.utils.timeutil import now_colombo
from app.utils.uploads import delete_upload

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ── Users ────────────────────────────────────────────────────────────────────

def _user_row(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role, "status": u.status,
            "is_verified": u.status != "pending", "district": u.district, "location": u.location,
            "phone_number": u.phone_number, "org_name": u.org_name, "ngo_status": u.ngo_status,
            "created_at": u.created_at}


def _target(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.role == "admin":
        raise HTTPException(403, "The admin account cannot be changed here")
    return user


@router.get("/users")
def list_users(role: Optional[str] = None, status: Optional[str] = None, q: Optional[str] = None,
               db: Session = Depends(get_db)):
    query = db.query(User).filter(User.role != "admin")
    if role:
        query = query.filter(User.role == role)
    if status:
        query = query.filter(User.status == status)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(User.name.ilike(like) | User.email.ilike(like) | User.org_name.ilike(like))
    return {"success": True, "users": [_user_row(u) for u in query.order_by(User.created_at.desc()).limit(1000)]}


@router.put("/users/{user_id}")
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db)):
    user = _target(db, user_id)
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(user, field, val)
    db.commit()
    return {"success": True, "message": "User updated"}


@router.patch("/users/{user_id}/suspend")
def toggle_suspend(user_id: int, db: Session = Depends(get_db)):
    user = _target(db, user_id)
    user.status = "suspended" if user.status == "active" else "active"
    db.commit()
    return {"success": True, "status": user.status}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, background: BackgroundTasks, db: Session = Depends(get_db)):
    purge_user(db, _target(db, user_id))
    schedule_emails(background, db)
    return {"success": True, "message": "User deleted"}


# ── NGO approval ─────────────────────────────────────────────────────────────

@router.get("/ngos")
def list_ngos(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(User).filter(User.role == "ngo")
    if status:
        query = query.filter(User.ngo_status == status)
    rows = query.order_by(User.created_at.desc()).all()
    return {"success": True, "ngos": [
        {**_user_row(u), "org_description": u.org_description, "org_logo": u.org_logo} for u in rows]}


def _decide_ngo(db: Session, background: BackgroundTasks, ngo_id: int, status: str, reason: str = "") -> dict:
    ngo = db.get(User, ngo_id)
    if not ngo or ngo.role != "ngo":
        raise HTTPException(404, "NGO not found")
    ngo.ngo_status = status
    if status == "approved":
        notify(db, ngo, "ngo_approved", "Your organisation was approved",
               "You can now post events, appear in the NGO directory and request food.", "/dashboard")
    else:
        notify(db, ngo, "ngo_rejected", "Your organisation was not approved",
               reason or "Please contact us if you think this is a mistake.", "/dashboard",
               details=[("Reason", reason)])
    db.commit()
    schedule_emails(background, db)
    return {"success": True, "ngo_status": ngo.ngo_status}


@router.post("/ngos/{ngo_id}/approve")
def approve_ngo(ngo_id: int, background: BackgroundTasks, db: Session = Depends(get_db)):
    return _decide_ngo(db, background, ngo_id, "approved")


@router.post("/ngos/{ngo_id}/reject")
def reject_ngo(ngo_id: int, background: BackgroundTasks, body: ReasonBody = ReasonBody(),
               db: Session = Depends(get_db)):
    if not body.reason.strip():
        raise HTTPException(400, "Please give a reason so the organisation knows what to fix")
    return _decide_ngo(db, background, ngo_id, "rejected", body.reason.strip())


# ── Listings & events (moderation only) ──────────────────────────────────────

@router.get("/listings")
def list_listings(status: Optional[str] = None, db: Session = Depends(get_db)):
    stock.run_expiry(db)
    query = db.query(FoodListing)
    if status:
        query = query.filter(FoodListing.status == status)
    return {"success": True, "listings": [
        {"id": x.id, "food_name": x.food_name, "category": x.category, "status": x.status, "district": x.district,
         "quantity_total": float(x.quantity_total), "quantity_available": float(x.quantity_available),
         "unit": x.unit, "expires_at": x.expires_at.isoformat(), "created_at": x.created_at,
         "donor_id": x.donor_id, "donor_name": x.donor.name if x.donor else None}
        for x in query.order_by(FoodListing.created_at.desc()).limit(1000)]}


@router.post("/listings/{listing_id}/close")
def close_any_listing(listing_id: int, background: BackgroundTasks, body: ReasonBody = ReasonBody(),
                      db: Session = Depends(get_db)):
    listing = stock.lock_listing(db, listing_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
    close_listing(db, listing, body.reason.strip(), by_admin=True)
    db.commit()
    schedule_emails(background, db)
    return {"success": True, "message": "Listing closed"}


@router.delete("/listings/{listing_id}")
def delete_any_listing(listing_id: int, db: Session = Depends(get_db)):
    """Hard delete for spam / abuse. Its requests and their ratings go with it."""
    listing = stock.lock_listing(db, listing_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
    photos = list(listing.images or [])
    db.query(Report).filter(Report.target_type == "listing", Report.target_id == listing_id).delete(synchronize_session=False)
    ids = [r.id for r in db.query(FoodRequest.id).filter(FoodRequest.listing_id == listing_id)]
    if ids:
        db.query(Feedback).filter(Feedback.request_id.in_(ids)).update({Feedback.request_id: None},
                                                                       synchronize_session=False)
        for r in db.query(FoodRequest).filter(FoodRequest.id.in_(ids)):
            db.delete(r)   # ORM delete so the ratings cascade
    db.delete(listing)
    db.commit()
    for url in photos:
        delete_upload(url)
    return {"success": True, "message": "Listing deleted"}


# ── Reports ──────────────────────────────────────────────────────────────────

@router.get("/reports")
def list_reports(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Report)
    if status:
        query = query.filter(Report.status == status)
    return {"success": True, "reports": [
        {"id": r.id, "reporter_id": r.reporter_id, "reporter_name": r.reporter.name if r.reporter else None,
         "target_type": r.target_type, "target_id": r.target_id, "reason": r.reason, "status": r.status,
         "admin_note": r.admin_note, "created_at": r.created_at}
        for r in query.order_by(Report.created_at.desc()).limit(1000)]}


@router.patch("/reports/{report_id}")
def update_report(report_id: int, body: ReportUpdate, db: Session = Depends(get_db)):
    if body.status not in ("open", "actioned", "dismissed"):
        raise HTTPException(400, "status must be open, actioned or dismissed")
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    report.status = body.status
    if body.admin_note is not None:
        report.admin_note = body.admin_note
    db.commit()
    return {"success": True, "message": "Report updated"}


# ── Feedback (messages to the admin) ─────────────────────────────────────────

@router.get("/feedback")
def list_feedback(db: Session = Depends(get_db)):
    rows = db.query(Feedback).order_by(Feedback.created_at.desc()).all()
    return {"success": True, "feedback": [
        {"id": f.id, "request_id": f.request_id, "author_id": f.recipient_id,
         "author_name": f.recipient.name if f.recipient else "Anonymous", "author_role": f.recipient.role if f.recipient else None,
         "rating": f.rating, "comment": f.comment, "image_path": f.image_path, "admin_reply": f.admin_reply,
         "feedback_status": f.feedback_status, "created_at": f.created_at}
        for f in rows]}


@router.post("/feedback/{feedback_id}/resolve")
def resolve_feedback(feedback_id: int, body: FeedbackReply, db: Session = Depends(get_db)):
    fb = db.get(Feedback, feedback_id)
    if not fb:
        raise HTTPException(404, "Feedback not found")
    fb.admin_reply = body.reply or ""
    fb.feedback_status = "resolved"
    db.commit()
    return {"success": True, "message": "Feedback resolved"}


@router.patch("/feedback/{feedback_id}/reopen")
def reopen_feedback(feedback_id: int, db: Session = Depends(get_db)):
    fb = db.get(Feedback, feedback_id)
    if not fb:
        raise HTTPException(404, "Feedback not found")
    fb.feedback_status = "open"
    fb.admin_reply = None
    db.commit()
    return {"success": True, "message": "Feedback reopened"}


@router.delete("/feedback/{feedback_id}")
def delete_feedback(feedback_id: int, db: Session = Depends(get_db)):
    fb = db.get(Feedback, feedback_id)
    if not fb:
        raise HTTPException(404, "Feedback not found")
    photo = fb.image_path
    db.delete(fb)
    db.commit()
    delete_upload(photo)
    return {"success": True, "message": "Feedback deleted"}


# ── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    stock.run_expiry(db)

    def grouped(col):
        return {k: n for k, n in db.query(col, func.count()).group_by(col).all()}

    top_categories = (db.query(FoodListing.category, func.count(FoodListing.id))
                      .group_by(FoodListing.category).order_by(func.count(FoodListing.id).desc()).limit(5).all())
    year = extract("year", FoodRequest.completed_at).label("year")
    month = extract("month", FoodRequest.completed_at).label("month")
    by_month = (db.query(year, month, func.count(FoodRequest.id))
                .filter(FoodRequest.status == "completed", FoodRequest.completed_at.isnot(None))
                .group_by(year, month).order_by(year, month).limit(12).all())
    return {
        "success": True,
        "total_users": db.query(func.count(User.id)).filter(User.role != "admin").scalar(),
        "users_by_role": grouped(User.role),
        "pending_ngos": db.query(func.count(User.id)).filter(User.role == "ngo", User.ngo_status == "pending").scalar(),
        "total_listings": db.query(func.count(FoodListing.id)).scalar(),
        "listings_by_status": grouped(FoodListing.status),
        "listings_by_district": grouped(FoodListing.district),
        "total_requests": db.query(func.count(FoodRequest.id)).scalar(),
        "requests_by_status": grouped(FoodRequest.status),
        "handovers_completed": db.query(func.count(FoodRequest.id)).filter(FoodRequest.status == "completed").scalar(),
        "open_reports": db.query(func.count(Report.id)).filter(Report.status == "open").scalar(),
        "open_feedback": db.query(func.count(Feedback.id)).filter(Feedback.feedback_status == "open").scalar(),
        "upcoming_events": db.query(func.count(CommunityEvent.id)).filter(
            CommunityEvent.status == "published", CommunityEvent.starts_at >= now_colombo()).scalar(),
        "top_categories": [{"category": c, "count": n} for c, n in top_categories],
        "completed_by_month": [{"year": int(y), "month": int(m), "count": n} for y, m, n in by_month],
    }
