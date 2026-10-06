"""One-time e-mail codes (verification and password reset): they expire and a wrong guess burns an attempt.

A 6-digit code has only a million values, so on its own it would be guessable. The code therefore lives for 15 minutes,
accepts at most 5 wrong guesses (after that it is dead and a new one must be requested), is compared in constant time
and is cleared the moment it is used.
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models import User
from app.utils.security import generate_otp

CODE_MINUTES = 15
MAX_ATTEMPTS = 5


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)   # stored as naive UTC


def issue_code(user: User) -> str:
    """A fresh code for this user (replaces any earlier one and resets the attempt counter). Caller commits."""
    code = generate_otp()
    user.verification_code = code
    user.verification_expires_at = _now() + timedelta(minutes=CODE_MINUTES)
    user.verification_attempts = 0
    return code


def clear_code(user: User) -> None:
    user.verification_code = None
    user.verification_expires_at = None
    user.verification_attempts = 0


def check_code(db: Session, user: Optional[User], submitted: str) -> bool:
    """True if `submitted` is the user's live code. A wrong guess is counted (and saved) here; the code dies after
    MAX_ATTEMPTS wrong guesses or when it expires. On success the caller clears it and commits."""
    if user is None or not user.verification_code:
        return False
    if user.verification_expires_at is None or user.verification_expires_at < _now():
        clear_code(user)
        db.commit()
        return False
    if secrets.compare_digest(user.verification_code.encode(), (submitted or "").encode()):
        return True
    user.verification_attempts = (user.verification_attempts or 0) + 1
    if user.verification_attempts >= MAX_ATTEMPTS:
        clear_code(user)
    db.commit()
    return False
