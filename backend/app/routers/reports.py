"""Anyone can report a listing, user, event or request; the admin reviews them under /api/admin/reports."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import optional_user
from app.models import CommunityEvent, FoodListing, FoodRequest, Report, User
from app.schemas import ReportIn
from app.utils.limiter import limiter

router = APIRouter(prefix="/api/reports", tags=["reports"])

_MODELS = {"listing": FoodListing, "user": User, "event": CommunityEvent, "request": FoodRequest}


@router.post("")
@limiter.limit("10/hour")
def report(request: Request, body: ReportIn, db: Session = Depends(get_db),
           me: Optional[User] = Depends(optional_user)):
    if not db.get(_MODELS[body.target_type], body.target_id):
        raise HTTPException(404, "That item no longer exists")
    if body.target_type == "user" and me and me.id == body.target_id:
        raise HTTPException(400, "You cannot report yourself")
    if me and db.query(Report).filter(Report.reporter_id == me.id, Report.target_type == body.target_type,
                                      Report.target_id == body.target_id, Report.status == "open").first():
        return {"success": True, "message": "Thanks - you have already reported this and we are looking at it"}
    db.add(Report(reporter_id=me.id if me else None, target_type=body.target_type, target_id=body.target_id,
                  reason=body.reason))
    db.commit()
    return {"success": True, "message": "Thank you - the admin will look into it"}
