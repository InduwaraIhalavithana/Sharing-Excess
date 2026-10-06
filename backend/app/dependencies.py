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


def is_admin(user: User) -> bool:
    return user.role == "admin"


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_roles(*roles: str):
    """Dependency factory: allow only the given roles (the admin is NOT implied)."""
    def _dep(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="You do not have permission to do this")
        return current_user
    return _dep


def can_receive_food(user: User) -> bool:
    """Recipients, and NGOs once the admin has approved them."""
    return user.role == "recipient" or (user.role == "ngo" and user.ngo_status == "approved")


def require_requester(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role == "ngo" and current_user.ngo_status != "approved":
        raise HTTPException(status_code=403, detail="Your organisation is waiting for admin approval")
    if not can_receive_food(current_user):
        raise HTTPException(status_code=403, detail="Only recipients and approved NGOs can request food")
    return current_user


def require_approved_ngo(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "ngo":
        raise HTTPException(status_code=403, detail="Only NGO accounts can do this")
    if current_user.ngo_status != "approved":
        raise HTTPException(status_code=403, detail="Your organisation is waiting for admin approval")
    return current_user


def _token_user(authorization: Optional[str], db: Session) -> Optional[User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    payload = decode_access_token(authorization[7:])
    if not payload:
        return None
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    return user if user and user.status != "suspended" else None


def optional_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """The signed-in user if a valid token was sent, otherwise None (never raises)."""
    return _token_user(authorization, db)
