from typing import Optional
from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.utils.jwt import decode_access_token


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(authorization[7:])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.status == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended")
    return user


def require_staff(current_user: User = Depends(get_current_user)) -> User:
    """Officer OR admin — coordination-level access."""
    if current_user.role not in ("officer", "admin"):
        raise HTTPException(status_code=403, detail="Officer access required")
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Admin only — platform management access."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# Backwards-compatible alias (old routes imported require_officer)
require_officer = require_staff
