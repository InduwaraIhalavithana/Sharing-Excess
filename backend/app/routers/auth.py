from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    SignupRequest, LoginRequest, OfficerLoginRequest,
    VerifyEmailRequest, ResendVerificationRequest,
    ForgotPasswordRequest, ResetPasswordRequest,
)
from app.utils.security import hash_password, verify_password, generate_otp
from app.utils.email import send_email, verification_email, forgot_password_email
from app.models import Officer

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup")
def signup(body: SignupRequest, db: Session = Depends(get_db)):
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
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(401, "Invalid email or password")
    if user.status == "pending":
        raise HTTPException(403, "Please verify your email before logging in")
    if user.status == "suspended":
        raise HTTPException(403, "Your account has been suspended")
    return {
        "success": True,
        "user": {
            "id": user.id, "name": user.name, "email": user.email,
            "role": user.role, "phone_number": user.phone_number,
            "location": user.location, "status": user.status,
        }
    }


@router.post("/officer-login")
def officer_login(body: OfficerLoginRequest, db: Session = Depends(get_db)):
    officer = db.query(Officer).filter(Officer.email == body.email).first()
    if not officer or not verify_password(body.password, officer.password):
        raise HTTPException(401, "Invalid email or password")
    if officer.status == "inactive":
        raise HTTPException(403, "This officer account is inactive")
    return {
        "success": True,
        "officer": {
            "id": officer.id, "name": officer.name,
            "email": officer.email, "role": "admin",
        }
    }


@router.post("/verify-email")
def verify_email(body: VerifyEmailRequest, db: Session = Depends(get_db)):
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
def resend_verification(body: ResendVerificationRequest, db: Session = Depends(get_db)):
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
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
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
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    user = db.query(User).filter(User.email == body.email).first()
    if not user or user.verification_code != body.code:
        raise HTTPException(400, "Invalid or expired reset code")
    user.password = hash_password(body.new_password)
    user.verification_code = None
    db.commit()
    return {"success": True, "message": "Password reset successfully"}
