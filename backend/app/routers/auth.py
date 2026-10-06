from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import EventSubscriber, Feedback, FoodListing, FoodRequest, User
from app.schemas import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    ForgotPasswordRequest,
    LoginRequest,
    ProfileUpdate,
    ResendVerificationRequest,
    ResetPasswordRequest,
    SignupRequest,
    VerifyEmailRequest,
)
from app.utils.email import forgot_password_email, send_email, verification_email
from app.utils.jwt import create_access_token
from app.utils.limiter import limiter
from app.utils.security import generate_otp, hash_password, verify_password
from app.utils.uploads import delete_upload

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup")
@limiter.limit("5/minute")
def signup(request: Request, body: SignupRequest, db: Session = Depends(get_db)):
    if not body.name or not body.email or not body.password:
        raise HTTPException(400, "Name, email and password are required")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, "Email already registered")

    code = generate_otp()
    user = User(
        name=body.name,
        email=body.email,
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
        return {"success": True, "message": "Registration successful! Check your email for the verification code.",
                "user_id": user.id, "email": user.email, "name": user.name, "role": user.role}
    return {"success": False, "message": "Registration successful but verification email could not be sent. Contact support."}


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(401, "Invalid email or password")
    if user.status == "pending":
        raise HTTPException(403, "Please verify your email before logging in")
    if user.status == "suspended":
        raise HTTPException(403, "Your account has been suspended")
    token = create_access_token(user.id, user.role)
    return {
        "success": True,
        "token": token,
        "user": {
            "id": user.id, "name": user.name, "email": user.email,
            "role": user.role, "phone_number": user.phone_number,
            "location": user.location, "status": user.status,
        }
    }


@router.post("/officer-login")
@limiter.limit("5/minute")
def officer_login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email, User.role == "adminofficer").first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(401, "Invalid email or password")
    if user.status == "suspended":
        raise HTTPException(403, "This account has been suspended")
    token = create_access_token(user.id, user.role)
    return {
        "success": True,
        "token": token,
        "officer": {
            "id": user.id, "name": user.name,
            "email": user.email, "role": user.role,
        }
    }


@router.post("/verify-email")
@limiter.limit("10/minute")
def verify_email(request: Request, body: VerifyEmailRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == body.user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.verification_code != body.code:
        raise HTTPException(400, "Invalid verification code")
    user.status = "active"
    user.verification_code = None
    db.commit()
    return {"success": True, "message": "Email verified successfully"}


@router.post("/resend-verification")
@limiter.limit("3/minute")
def resend_verification(request: Request, body: ResendVerificationRequest, db: Session = Depends(get_db)):
    # Always return success to prevent email enumeration
    user = db.query(User).filter(User.email == body.email).first()
    if user and user.status == "pending":
        code = generate_otp()
        user.verification_code = code
        db.commit()
        send_email(body.email, "Email Verification – Sharing Excess",
                   verification_email(user.name, code))
    return {"success": True, "message": "If that email exists and is unverified, a new code has been sent."}


@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    # Always return success to prevent email enumeration
    user = db.query(User).filter(User.email == body.email).first()
    if user:
        code = generate_otp()
        user.verification_code = code
        db.commit()
        send_email(body.email, "Password Reset – Sharing Excess",
                   forgot_password_email(code))
    return {"success": True, "message": "If that email exists, a reset code has been sent."}


@router.post("/reset-password")
@limiter.limit("5/minute")
def reset_password(request: Request, body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    user = db.query(User).filter(User.email == body.email).first()
    if not user or user.verification_code != body.code:
        raise HTTPException(400, "Invalid or expired reset code")
    user.password = hash_password(body.new_password)
    user.verification_code = None
    db.commit()
    return {"success": True, "message": "Password reset successfully"}


# ── Account settings (signed-in user) ────────────────────────────────────────

def _me(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role,
            "phone_number": u.phone_number, "location": u.location, "status": u.status}


@router.get("/me")
def get_me(me: User = Depends(get_current_user)):
    return {"success": True, "user": _me(me)}


@router.put("/me")
def update_me(body: ProfileUpdate, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Name, phone and location only - email and role can never be changed here."""
    me.name = body.name
    me.phone_number = body.phone_number or None
    me.location = body.location.strip() or None
    db.commit()
    db.refresh(me)
    return {"success": True, "message": "Profile updated", "user": _me(me)}


@router.post("/change-password")
@limiter.limit("5/minute")
def change_password(request: Request, body: ChangePasswordRequest,
                    db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    if not verify_password(body.current_password, me.password):
        raise HTTPException(400, "Your current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters")
    if body.new_password == body.current_password:
        raise HTTPException(400, "New password must be different from the current one")
    me.password = hash_password(body.new_password)
    db.commit()
    return {"success": True, "message": "Password changed"}


@router.delete("/me")
@limiter.limit("3/minute")
def delete_my_account(request: Request, body: DeleteAccountRequest,
                      db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Self-service account deletion: asks for the password, then removes the account and its data.

    Staff accounts are protected - they are managed by other staff, never self-deleted.
    """
    if me.role == "adminofficer":
        raise HTTPException(403, "Staff accounts cannot be deleted here")
    if not verify_password(body.password, me.password):
        raise HTTPException(400, "That password is not correct")

    photos: list[str | None] = []
    listing_ids = [x.id for x in db.query(FoodListing).filter(FoodListing.donor_id == me.id)]
    photos += [x.image_path for x in db.query(FoodListing).filter(FoodListing.donor_id == me.id)]
    my_requests = db.query(FoodRequest).filter(FoodRequest.recipient_id == me.id).all()
    photos += [r.image_path for r in my_requests]
    request_ids = [r.id for r in my_requests]

    # Other people's requests that pointed at this donor's listings keep existing, just unlinked
    if listing_ids:
        on_my_listings = FoodRequest.listing_id.in_(listing_ids)
        db.query(FoodRequest).filter(on_my_listings, FoodRequest.accepted_by == me.name).update(
            {FoodRequest.accepted_by: "A former donor"}, synchronize_session=False)
        db.query(FoodRequest).filter(on_my_listings).update({FoodRequest.listing_id: None}, synchronize_session=False)

    feedback = db.query(Feedback).filter((Feedback.recipient_id == me.id) | (Feedback.request_id.in_(request_ids or [0])))
    photos += [f.image_path for f in feedback]
    feedback.delete(synchronize_session=False)
    db.query(FoodRequest).filter(FoodRequest.recipient_id == me.id).delete(synchronize_session=False)
    db.query(FoodListing).filter(FoodListing.donor_id == me.id).delete(synchronize_session=False)
    db.query(EventSubscriber).filter(EventSubscriber.email == me.email.lower()).delete(synchronize_session=False)
    db.delete(me)  # event sign-ups go with it (ON DELETE CASCADE)
    db.commit()

    for url in photos:
        delete_upload(url)
    return {"success": True, "message": "Your account and its data have been deleted"}
