from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
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
from app.services.accounts import purge_user
from app.services.notifications import schedule_emails
from app.services.otp import check_code, clear_code, issue_code
from app.utils.email import forgot_password_email, send_email, verification_email
from app.utils.jwt import create_access_token
from app.utils.limiter import limiter
from app.utils.security import hash_password, verify_password

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

    if body.role not in ("donor", "recipient", "ngo"):
        raise HTTPException(400, "Choose an account type: donor, recipient or NGO")
    role = body.role
    user = User(
        name=body.name,
        email=body.email,
        password=hash_password(body.password),
        role=role,
        phone_number=body.phone_number or None,
        location=body.location.strip() or None,
        district=body.district,
        org_name=body.org_name.strip() or None if role == "ngo" else None,
        org_description=body.org_description.strip() or None if role == "ngo" else None,
        ngo_status="pending" if role == "ngo" else None,
        status="pending",
    )
    code = issue_code(user)
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
        "user": _me(user),
    }


@router.post("/admin-login")
@limiter.limit("5/minute")
def admin_login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email, User.role == "admin").first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(401, "Invalid email or password")
    if user.status == "suspended":
        raise HTTPException(403, "This account has been suspended")
    token = create_access_token(user.id, user.role)
    return {
        "success": True,
        "token": token,
        "admin": {
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
    if user.status != "pending":
        raise HTTPException(400, "This account is already verified")
    if not check_code(db, user, body.code):
        raise HTTPException(400, "Invalid or expired verification code - request a new one")
    user.status = "active"
    clear_code(user)
    db.commit()
    return {"success": True, "message": "Email verified successfully"}


@router.post("/resend-verification")
@limiter.limit("3/minute")
def resend_verification(request: Request, body: ResendVerificationRequest, db: Session = Depends(get_db)):
    # Always return success to prevent email enumeration
    user = db.query(User).filter(User.email == body.email).first()
    if user and user.status == "pending":
        code = issue_code(user)
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
        code = issue_code(user)
        db.commit()
        send_email(body.email, "Password Reset – Sharing Excess",
                   forgot_password_email(code))
    return {"success": True, "message": "If that email exists, a reset code has been sent."}


@router.post("/reset-password")
@limiter.limit("5/minute")
def reset_password(request: Request, body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if not 8 <= len(body.new_password) <= 128:
        raise HTTPException(400, "Password must be 8-128 characters")
    user = db.query(User).filter(User.email == body.email).first()
    if not check_code(db, user, body.code):
        raise HTTPException(400, "Invalid or expired reset code - request a new one")
    user.password = hash_password(body.new_password)
    clear_code(user)
    db.commit()
    return {"success": True, "message": "Password reset successfully"}


# ── Account settings (signed-in user) ────────────────────────────────────────

def _me(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role,
            "phone_number": u.phone_number, "location": u.location, "district": u.district,
            "status": u.status, "notify_districts": list(u.notify_districts or []),
            "notify_food_types": list(u.notify_food_types or []), "notify_email": u.notify_email,
            "org_name": u.org_name, "org_description": u.org_description, "org_logo": u.org_logo,
            "ngo_status": u.ngo_status}


@router.get("/me")
def get_me(me: User = Depends(get_current_user)):
    return {"success": True, "user": _me(me)}


@router.put("/me")
def update_me(body: ProfileUpdate, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Name, phone, location, district and notification choices - email and role can never be changed here."""
    me.name = body.name
    me.phone_number = body.phone_number or None
    me.location = body.location.strip() or None
    if body.district:
        me.district = body.district
    if body.notify_districts is not None:
        me.notify_districts = body.notify_districts
    if body.notify_food_types is not None:
        me.notify_food_types = body.notify_food_types
    if body.notify_email is not None:
        me.notify_email = body.notify_email
    db.commit()
    db.refresh(me)
    return {"success": True, "message": "Profile updated", "user": _me(me)}


@router.post("/change-password")
@limiter.limit("5/minute")
def change_password(request: Request, body: ChangePasswordRequest,
                    db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    if not verify_password(body.current_password, me.password):
        raise HTTPException(400, "Your current password is incorrect")
    if not 8 <= len(body.new_password) <= 128:
        raise HTTPException(400, "New password must be 8-128 characters")
    if body.new_password == body.current_password:
        raise HTTPException(400, "New password must be different from the current one")
    me.password = hash_password(body.new_password)
    db.commit()
    return {"success": True, "message": "Password changed"}


@router.delete("/me")
@limiter.limit("3/minute")
def delete_my_account(request: Request, body: DeleteAccountRequest, background: BackgroundTasks,
                      db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Self-service account deletion: asks for the password, then removes the account and its data.

    The admin account is protected - it is never self-deleted.
    """
    if me.role == "admin":
        raise HTTPException(403, "The admin account cannot be deleted here")
    if not verify_password(body.password, me.password):
        raise HTTPException(400, "That password is not correct")
    purge_user(db, me)
    schedule_emails(background, db)
    return {"success": True, "message": "Your account and its data have been deleted"}
