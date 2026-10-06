from typing import Optional

from fastapi import Depends, Header, HTTPException
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


STAFF_ROLE = "adminofficer"


def is_staff(user: User) -> bool:
    """One staff role carries both the old admin and officer privileges."""
    return user.role == STAFF_ROLE


def require_staff(current_user: User = Depends(get_current_user)) -> User:
    if not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Admin-officer access required")
    return current_user


# Kept so existing route signatures read naturally; all three mean the same thing now.
require_admin = require_staff
require_officer = require_staff


def require_roles(*roles: str):
    """Dependency factory: allow only the given roles (staff are NOT implied)."""
    def _dep(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="You do not have permission to do this")
        return current_user
    return _dep
