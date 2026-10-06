"""The NGO directory (approved organisations only) and an NGO's own profile."""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models import CommunityEvent, User
from app.routers.auth import _me
from app.utils.params import district_list
from app.utils.timeutil import now_colombo
from app.utils.uploads import delete_upload, save_upload

router = APIRouter(prefix="/api/ngos", tags=["ngos"])


def _card(u: User, upcoming: int) -> dict:
    """Directory entry. Deliberately no email or phone: people reach an NGO through its events' contact details."""
    return {"id": u.id, "org_name": u.org_name or u.name, "description": u.org_description, "logo": u.org_logo,
            "district": u.district, "upcoming_events": upcoming}


def _upcoming_counts(db: Session) -> dict[int, int]:
    return dict(db.query(CommunityEvent.owner_id, func.count(CommunityEvent.id)).filter(
        CommunityEvent.status == "published",
        func.coalesce(CommunityEvent.ends_at, CommunityEvent.starts_at) >= now_colombo()
    ).group_by(CommunityEvent.owner_id).all())


@router.get("")
def directory(district: Optional[str] = None, q: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(User).filter(User.role == "ngo", User.ngo_status == "approved", User.status == "active")
    if district:
        query = query.filter(User.district.in_(district_list(district)))
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(User.org_name.ilike(like) | User.org_description.ilike(like))
    counts = _upcoming_counts(db)
    rows = query.order_by(User.org_name.asc()).limit(500).all()
    return {"success": True, "ngos": [_card(u, counts.get(u.id, 0)) for u in rows]}


@router.get("/{ngo_id}")
def ngo_detail(ngo_id: int, db: Session = Depends(get_db)):
    u = db.get(User, ngo_id)
    if not u or u.role != "ngo" or u.ngo_status != "approved" or u.status != "active":
        raise HTTPException(404, "Organisation not found")
    return {"success": True, "ngo": _card(u, _upcoming_counts(db).get(u.id, 0))}


@router.put("/me")
async def update_my_organisation(
    org_name: str = Form(...),
    org_description: str = Form(""),
    logo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    me: User = Depends(require_roles("ngo")),
):
    org_name = org_name.strip()
    if not 2 <= len(org_name) <= 200:
        raise HTTPException(400, "Organisation name must be 2-200 characters")
    if len(org_description) > 2000:
        raise HTTPException(400, "Description must be 2000 characters or fewer")
    old_logo = me.org_logo
    if logo and logo.filename:
        me.org_logo = await save_upload(logo, prefix="logo")
    me.org_name = org_name
    me.org_description = org_description.strip() or None
    db.commit()
    if logo and logo.filename:
        delete_upload(old_logo)
    return {"success": True, "message": "Organisation profile updated", "user": _me(me)}
