"""
PHP-compatibility router — maps every old *.php URL to the new FastAPI handlers.
The frontend still calls ${API_BASE}/login.php etc.; this layer translates them
so the frontend source files need zero changes.
"""
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, FoodListing, FoodRequest, Feedback
from app.schemas import (
    SignupRequest, LoginRequest,
    ResendVerificationRequest, ForgotPasswordRequest,
    ListingUpdate, RequestUpdate, UserUpdate,
)
from app.utils.security import hash_password, verify_password, generate_otp
from app.utils.email import (
    send_email, verification_email, forgot_password_email, money_donation_email
)
from app.utils.uploads import save_upload
from app.utils.jwt import create_access_token
from app.dependencies import require_officer

# Import the handlers we can re-use directly
from app.routers.listings import get_listings, add_listing
from app.routers.requests import get_requests
from app.routers.calendar import get_calendar_events
from app.routers.feedback import get_feedback, submit_feedback
from app.routers.contact import contact
from app.routers.donations import add_money_donation

router = APIRouter(tags=["compat"])


def _ok(payload: dict) -> JSONResponse:
    return JSONResponse(content={"success": True, **payload})


def _err(msg: str, status: int = 200) -> JSONResponse:
    """Always return 200 with {success:false} so the frontend JSON-parses it."""
    return JSONResponse(content={"success": False, "message": msg}, status_code=200)


# ══════════════════════════════════════════════════════════════════════════════
# AUTH
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/login.php")
def login_compat(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password):
        return _err("Invalid email or password.")
    if user.status == "pending":
        return _err("Please verify your email before logging in.")
    if user.status == "suspended":
        return _err("Your account has been suspended. Please contact support.")
    token = create_access_token(user.id, user.role)
    return _ok({"token": token, "user": {
        "id": user.id, "name": user.name, "email": user.email,
        "role": user.role, "phone_number": user.phone_number,
        "location": user.location, "status": user.status,
    }})


@router.post("/officer_login.php")
def officer_login_compat(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email, User.role == "officer").first()
    if not user or not verify_password(body.password, user.password):
        return _err("Invalid email or password.")
    if user.status == "suspended":
        return _err("This officer account has been suspended.")
    token = create_access_token(user.id, user.role)
    return _ok({"token": token, "user": {
        "id": user.id, "name": user.name,
        "email": user.email, "role": "admin",
    }})


@router.post("/signup.php")
def signup_compat(body: SignupRequest, db: Session = Depends(get_db)):
    if not body.name or not body.email or not body.password:
        return _err("Name, email and password are required.")
    if len(body.password) < 6:
        return _err("Password must be at least 6 characters.")
    if db.query(User).filter(User.email == body.email).first():
        return _err("This email is already registered.")

    code = generate_otp()
    user = User(
        name=body.name, email=body.email,
        password=hash_password(body.password),
        role=body.role if body.role in ("donor", "recipient") else "recipient",
        phone_number=body.phone_number or None,
        location=body.location or None,
        status="pending",
        verification_code=code,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    sent = send_email(body.email, "Email Verification – Sharing Excess",
                      verification_email(body.name, code))
    if sent:
        return _ok({"message": "Registration successful! Check your email.",
                    "user_id": user.id, "email": user.email,
                    "name": user.name, "role": user.role})
    return _err("Registration successful but email could not be sent. Contact support.")


@router.post("/verify_email.php")
async def verify_email_compat(request: Request, db: Session = Depends(get_db)):
    """Frontend sends {email, verification_code} — different from /api/auth/verify-email."""
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    code = str(body.get("verification_code") or body.get("code") or "").strip()
    if not email or not code:
        return _err("Email and verification code are required.")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return _err("Invalid verification code.")
    if user.verification_code != code:
        return _err("Invalid verification code.")
    user.status = "active"
    user.verification_code = None
    db.commit()
    return _ok({"message": "Email verified successfully!"})


@router.post("/resend_verification.php")
def resend_verification_compat(body: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if user and user.status == "pending":
        code = generate_otp()
        user.verification_code = code
        db.commit()
        send_email(body.email, "Email Verification – Sharing Excess",
                   verification_email(user.name, code))
    return _ok({"message": "If that email exists and is unverified, a new code has been sent."})


@router.post("/forgot_password.php")
def forgot_password_compat(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if user:
        code = generate_otp()
        user.verification_code = code
        db.commit()
        send_email(body.email, "Password Reset – Sharing Excess",
                   forgot_password_email(code))
    return _ok({"message": "If that email exists, a reset code has been sent."})


@router.post("/reset_password.php")
async def reset_password_compat(request: Request, db: Session = Depends(get_db)):
    """Frontend sends {email, code, newpassword} — note lowercase newpassword."""
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    code = str(body.get("code") or "").strip()
    new_pw = str(body.get("newpassword") or body.get("new_password") or "").strip()
    if not email or not code or not new_pw:
        return _err("Email, code and new password are required.")
    if len(new_pw) < 6:
        return _err("Password must be at least 6 characters.")
    user = db.query(User).filter(User.email == email).first()
    if not user or user.verification_code != code:
        return _err("Invalid or expired reset code.")
    user.password = hash_password(new_pw)
    user.verification_code = None
    db.commit()
    return _ok({"message": "Password reset successfully."})


# ══════════════════════════════════════════════════════════════════════════════
# LISTINGS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/get_listings.php")
def get_listings_compat(donor_id: Optional[int] = None, db: Session = Depends(get_db)):
    return get_listings(donor_id=donor_id, db=db)


@router.post("/add_listing.php")
async def add_listing_compat(
    donor_id:      int                    = Form(...),
    food_name:     str                    = Form(...),
    quantity:      str                    = Form(...),
    expiry_date:   str                    = Form(""),
    location:      str                    = Form(""),
    description:   str                    = Form(""),
    contact_phone: str                    = Form(""),
    contact_email: str                    = Form(""),
    food_image:    Optional[UploadFile]   = File(None),
    db: Session                           = Depends(get_db),
):
    return await add_listing(
        donor_id=donor_id, food_name=food_name, quantity=quantity,
        expiry_date=expiry_date, location=location, description=description,
        contact_phone=contact_phone, contact_email=contact_email,
        food_image=food_image, db=db,
    )


@router.post("/get_donor_donations.php")
async def get_donor_donations_compat(request: Request, db: Session = Depends(get_db)):
    """Frontend POSTs {donor_id}; returns {success, donations:[...]}."""
    body = await request.json()
    donor_id = body.get("donor_id")
    if not donor_id:
        return _err("donor_id is required.")
    result = get_listings(donor_id=int(donor_id), db=db)
    # get_listings returns a plain dict; rename key listings → donations
    return {"success": True, "donations": result.get("listings", [])}


# ══════════════════════════════════════════════════════════════════════════════
# REQUESTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/get_requests.php")
def get_requests_compat(
    recipient_id: Optional[int] = None,
    donor_view:   Optional[str] = None,
    db: Session = Depends(get_db),
):
    return get_requests(recipient_id=recipient_id, donor_view=donor_view, db=db)


@router.post("/request_food.php")
async def request_food_compat(request: Request, db: Session = Depends(get_db)):
    """Frontend sends JSON (not FormData) for this endpoint."""
    body = await request.json()
    recipient_id = body.get("recipient_id")
    food_name    = str(body.get("food_name") or "").strip()
    quantity     = str(body.get("quantity") or "").strip()
    needed_by    = str(body.get("needed_by") or "").strip()
    location     = str(body.get("location") or "").strip()
    description  = str(body.get("description") or "").strip()
    listing_id   = body.get("listing_id")

    if not recipient_id or not food_name:
        return _err("recipient_id and food_name are required.")
    if not db.query(User).filter(User.id == int(recipient_id)).first():
        return _err("Recipient not found.")

    req = FoodRequest(
        recipient_id=int(recipient_id),
        food_name=food_name,
        quantity=quantity or None,
        needed_by=needed_by or None,
        location=location or None,
        description=description or None,
        listing_id=int(listing_id) if listing_id else None,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return _ok({"message": "Food request submitted successfully.", "request_id": req.id})


@router.post("/respond_to_request.php")
async def respond_to_request_compat(request: Request, db: Session = Depends(get_db)):
    """Frontend POSTs {request_id, status, user_id, user_name}."""
    body = await request.json()
    request_id = body.get("request_id")
    status     = str(body.get("status") or "").strip()
    user_id    = body.get("user_id")
    user_name  = str(body.get("user_name") or "")

    if not request_id or status not in ("accepted", "declined"):
        return _err("request_id and valid status are required.")

    req = db.query(FoodRequest).filter(FoodRequest.id == int(request_id)).first()
    if not req:
        return _err("Request not found.")

    req.status = status
    if status == "accepted":
        req.accepted_by = user_name or None
        if req.listing_id:
            listing = db.query(FoodListing).filter(FoodListing.id == req.listing_id).first()
            if listing:
                listing.status = "accepted"
                listing.accepted_by = user_name or None
        donor_phone = ""
        if user_id:
            donor = db.query(User).filter(User.id == int(user_id)).first()
            donor_phone = donor.phone_number or "" if donor else ""
        db.commit()
        return _ok({"message": "Request accepted.", "donor_phone": donor_phone})

    db.commit()
    return _ok({"message": "Request declined."})


@router.post("/delete_food_request.php")
async def delete_food_request_compat(request: Request, db: Session = Depends(get_db)):
    """Frontend POSTs {request_id, recipient_id}."""
    body = await request.json()
    request_id = body.get("request_id") or body.get("id")
    if not request_id:
        return _err("request_id is required.")
    req = db.query(FoodRequest).filter(FoodRequest.id == int(request_id)).first()
    if not req:
        return _err("Request not found.")
    db.delete(req)
    db.commit()
    return _ok({"message": "Request deleted."})


@router.post("/update_delivery_status.php")
async def update_delivery_status_compat(request: Request, db: Session = Depends(get_db)):
    """Frontend POSTs {request_id, status}."""
    body = await request.json()
    request_id = body.get("request_id")
    status     = str(body.get("status") or "").strip()
    if not request_id or not status:
        return _err("request_id and status are required.")
    req = db.query(FoodRequest).filter(FoodRequest.id == int(request_id)).first()
    if not req:
        return _err("Request not found.")
    req.status = status
    db.commit()
    return _ok({"message": "Status updated."})


# ══════════════════════════════════════════════════════════════════════════════
# CALENDAR
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/get_calendar_events.php")
def get_calendar_events_compat(db: Session = Depends(get_db)):
    return get_calendar_events(db=db)


# ══════════════════════════════════════════════════════════════════════════════
# FEEDBACK
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/get_feedback.php")
def get_feedback_compat(db: Session = Depends(get_db)):
    return get_feedback(db=db)


@router.post("/submit_feedback.php")
async def submit_feedback_compat(
    recipient_id: int                   = Form(...),
    comment:      str                   = Form(...),
    request_id:   int                   = Form(0),
    rating:       Optional[int]         = Form(None),
    image:        Optional[UploadFile]  = File(None),
    db: Session                         = Depends(get_db),
):
    return await submit_feedback(
        recipient_id=recipient_id, comment=comment,
        request_id=request_id, rating=rating,
        image=image, db=db,
    )


@router.post("/share_feedback.php")
async def share_feedback_compat(request: Request):
    """PHP-era 'share feedback to public board' action — no-op in new system."""
    return _ok({"message": "Feedback shared."})


# ══════════════════════════════════════════════════════════════════════════════
# CONTACT & DONATIONS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/contact.php")
async def contact_compat(request: Request, db: Session = Depends(get_db)):
    from app.schemas import ContactRequest
    body = await request.json()
    try:
        schema = ContactRequest(**body)
        return contact(body=schema, db=db)
    except Exception as e:
        return _err(str(e))


@router.post("/add_money_donation.php")
async def add_money_donation_compat(request: Request, db: Session = Depends(get_db)):
    from app.schemas import MoneyDonationRequest
    body = await request.json()
    try:
        schema = MoneyDonationRequest(**body)
        return add_money_donation(body=schema, db=db)
    except Exception as e:
        return _err(str(e))


# ══════════════════════════════════════════════════════════════════════════════
# OFFICER — all routes require officer JWT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/officer_list_requests.php")
def officer_list_requests_compat(
    _: User = Depends(require_officer), db: Session = Depends(get_db)
):
    requests = db.query(FoodRequest).order_by(FoodRequest.created_at.desc()).all()
    return {"success": True, "requests": [
        {"id": r.id, "food_item": r.food_name, "quantity": r.quantity,
         "needed_by": r.needed_by, "location": r.location, "status": r.status,
         "accepted_by": r.accepted_by, "created_at": r.created_at,
         "recipient_name": r.recipient.name if r.recipient else None,
         "recipient_email": r.recipient.email if r.recipient else None}
        for r in requests
    ]}


@router.get("/officer_list_listings.php")
def officer_list_listings_compat(
    _: User = Depends(require_officer), db: Session = Depends(get_db)
):
    listings = db.query(FoodListing).order_by(FoodListing.created_at.desc()).all()
    return {"success": True, "listings": [
        {"id": l.id, "food_name": l.food_name, "description": l.description,
         "quantity": l.quantity, "status": l.status, "expiry_date": l.expiry_date,
         "location": l.location, "created_at": l.created_at, "donor_id": l.donor_id,
         "donor_name": l.donor.name if l.donor else None}
        for l in listings
    ]}


@router.get("/officer_list_users.php")
def officer_list_users_compat(
    _: User = Depends(require_officer), db: Session = Depends(get_db)
):
    users = db.query(User).filter(User.role != "officer").order_by(User.created_at.desc()).all()
    return {"success": True, "users": [
        {"id": u.id, "name": u.name, "email": u.email, "role": u.role,
         "status": u.status, "is_verified": u.status == "active",
         "location": getattr(u, "location", None), "created_at": u.created_at}
        for u in users
    ]}


@router.get("/officer_list_money_donations.php")
def officer_list_money_donations_compat(
    _: User = Depends(require_officer), db: Session = Depends(get_db)
):
    from app.models import MoneyDonation
    donations = db.query(MoneyDonation).order_by(MoneyDonation.created_at.desc()).all()
    return {"success": True, "donations": [
        {"id": d.id, "name": d.name, "email": d.email,
         "amount": float(d.amount), "card_last4": d.card_last4, "created_at": d.created_at}
        for d in donations
    ]}


@router.post("/officer_update_request.php")
async def officer_update_request_compat(
    request: Request, _: User = Depends(require_officer), db: Session = Depends(get_db)
):
    body = await request.json()
    request_id = body.get("request_id")
    updates    = body.get("updates") or {}
    if not request_id:
        return _err("request_id is required.")
    req = db.query(FoodRequest).filter(FoodRequest.id == int(request_id)).first()
    if not req:
        return _err("Request not found.")
    for k, v in updates.items():
        if k in {"status", "accepted_by"}:
            setattr(req, k, v)
    db.commit()
    return _ok({"message": "Request updated."})


@router.post("/officer_delete_request.php")
async def officer_delete_request_compat(
    request: Request, _: User = Depends(require_officer), db: Session = Depends(get_db)
):
    body = await request.json()
    request_id = body.get("request_id") or body.get("id")
    if not request_id:
        return _err("request_id is required.")
    req = db.query(FoodRequest).filter(FoodRequest.id == int(request_id)).first()
    if not req:
        return _err("Request not found.")
    db.delete(req)
    db.commit()
    return _ok({"message": "Request deleted."})


@router.post("/officer_update_listing.php")
async def officer_update_listing_compat(
    request: Request, _: User = Depends(require_officer), db: Session = Depends(get_db)
):
    body = await request.json()
    listing_id = body.get("listing_id")
    updates    = body.get("updates") or {}
    if not listing_id:
        return _err("listing_id is required.")
    listing = db.query(FoodListing).filter(FoodListing.id == int(listing_id)).first()
    if not listing:
        return _err("Listing not found.")
    for k, v in updates.items():
        if k in {"food_name", "quantity", "expiry_date", "location", "description", "status"}:
            setattr(listing, k, v)
    db.commit()
    return _ok({"message": "Listing updated."})


@router.post("/officer_delete_listing.php")
async def officer_delete_listing_compat(
    request: Request, _: User = Depends(require_officer), db: Session = Depends(get_db)
):
    body = await request.json()
    listing_id = body.get("listing_id") or body.get("id")
    if not listing_id:
        return _err("listing_id is required.")
    listing = db.query(FoodListing).filter(FoodListing.id == int(listing_id)).first()
    if not listing:
        return _err("Listing not found.")
    db.delete(listing)
    db.commit()
    return _ok({"message": "Listing deleted."})


@router.post("/officer_update_user.php")
async def officer_update_user_compat(
    request: Request, _: User = Depends(require_officer), db: Session = Depends(get_db)
):
    body = await request.json()
    user_id = body.get("user_id")
    updates = body.get("updates") or {}
    if not user_id:
        return _err("user_id is required.")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        return _err("User not found.")
    for k, v in updates.items():
        if k == "is_verified":
            user.status = "active" if v else "pending"
        elif k in {"name", "email", "role", "status", "phone_number", "location"}:
            setattr(user, k, v)
    db.commit()
    return _ok({"message": "User updated."})


@router.post("/officer_suspend_user.php")
async def officer_suspend_user_compat(
    request: Request, _: User = Depends(require_officer), db: Session = Depends(get_db)
):
    body = await request.json()
    user_id = body.get("user_id")
    if not user_id:
        return _err("user_id is required.")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        return _err("User not found.")
    user.status = "suspended" if user.status == "active" else "active"
    db.commit()
    return _ok({"status": user.status})


@router.post("/officer_delete_user.php")
async def officer_delete_user_compat(
    request: Request, _: User = Depends(require_officer), db: Session = Depends(get_db)
):
    body = await request.json()
    user_id = body.get("user_id")
    if not user_id:
        return _err("user_id is required.")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        return _err("User not found.")
    db.delete(user)
    db.commit()
    return _ok({"message": "User deleted."})


@router.get("/admin_list_feedback.php")
def admin_list_feedback_compat(_: User = Depends(require_officer), db: Session = Depends(get_db)):
    from app.models import Feedback
    rows = db.query(Feedback).order_by(Feedback.created_at.desc()).all()
    return {"success": True, "feedback": [
        {"id": f.id, "request_id": f.request_id, "recipient_id": f.recipient_id,
         "recipient_name": f.recipient.name if f.recipient else "Anonymous",
         "rating": f.rating, "comment": f.comment, "image_path": f.image_path,
         "admin_reply": f.admin_reply, "feedback_status": f.feedback_status,
         "created_at": f.created_at}
        for f in rows
    ]}


@router.post("/admin_resolve_feedback.php")
async def admin_resolve_feedback_compat(
    request: Request, _: User = Depends(require_officer), db: Session = Depends(get_db)
):
    from app.models import Feedback
    body = await request.json()
    feedback_id = body.get("feedback_id")
    reply = body.get("reply", "")
    if not feedback_id:
        return _err("feedback_id is required.")
    fb = db.query(Feedback).filter(Feedback.id == int(feedback_id)).first()
    if not fb:
        return _err("Feedback not found.")
    fb.admin_reply = reply
    fb.feedback_status = "resolved"
    db.commit()
    return _ok({"message": "Feedback resolved."})


@router.post("/admin_reopen_feedback.php")
async def admin_reopen_feedback_compat(
    request: Request, _: User = Depends(require_officer), db: Session = Depends(get_db)
):
    from app.models import Feedback
    body = await request.json()
    feedback_id = body.get("feedback_id")
    if not feedback_id:
        return _err("feedback_id is required.")
    fb = db.query(Feedback).filter(Feedback.id == int(feedback_id)).first()
    if not fb:
        return _err("Feedback not found.")
    fb.feedback_status = "open"
    fb.admin_reply = None
    db.commit()
    return _ok({"message": "Feedback reopened."})


@router.get("/admin_stats.php")
def admin_stats_compat(_: User = Depends(require_officer), db: Session = Depends(get_db)):
    from app.models import FoodRequest, FoodListing, MoneyDonation
    from sqlalchemy import func, extract
    total_requests  = db.query(FoodRequest).count()
    total_listings  = db.query(FoodListing).count()
    total_users     = db.query(User).count()
    total_donations = db.query(MoneyDonation).count()
    req_by_status = dict(
        db.query(FoodRequest.status, func.count(FoodRequest.id))
          .group_by(FoodRequest.status).all()
    )
    users_by_role = dict(
        db.query(User.role, func.count(User.id)).group_by(User.role).all()
    )
    top_foods = (
        db.query(FoodRequest.food_name, func.count(FoodRequest.id).label("count"))
          .group_by(FoodRequest.food_name)
          .order_by(func.count(FoodRequest.id).desc()).limit(5).all()
    )
    donations_by_month = (
        db.query(
            extract("year", FoodRequest.created_at).label("year"),
            extract("month", FoodRequest.created_at).label("month"),
            func.count(FoodRequest.id).label("count"),
        )
        .filter(FoodRequest.status == "accepted")
        .group_by("year", "month").order_by("year", "month").limit(6).all()
    )
    return {
        "success": True,
        "total_requests": total_requests, "total_listings": total_listings,
        "total_users": total_users, "total_money_donations": total_donations,
        "requests_by_status": req_by_status, "users_by_role": users_by_role,
        "top_requested_foods": [{"name": f[0], "count": f[1]} for f in top_foods],
        "donations_by_month": [{"year": int(d[0]), "month": int(d[1]), "count": d[2]}
                                for d in donations_by_month],
    }
