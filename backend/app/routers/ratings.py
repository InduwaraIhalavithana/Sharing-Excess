"""Ratings both ways, once a handover is completed: the recipient rates the donor, the donor rates the recipient."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import FoodRequest, Rating, User
from app.schemas import RatingIn
from app.services.notifications import notify

router = APIRouter(prefix="/api/ratings", tags=["ratings"])


@router.post("")
def rate(body: RatingIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    req = db.get(FoodRequest, body.request_id)
    if not req:
        raise HTTPException(404, "Request not found")
    donor_id = req.listing.donor_id
    if me.id == req.recipient_id:
        ratee_id = donor_id
    elif me.id == donor_id:
        ratee_id = req.recipient_id
    else:
        raise HTTPException(404, "Request not found")
    if req.status != "completed":
        raise HTTPException(400, "You can rate once the handover is marked completed")
    db.add(Rating(request_id=req.id, rater_id=me.id, ratee_id=ratee_id, score=body.score,
                  comment=body.comment or None))
    notify(db, db.get(User, ratee_id), "rating_received", f"{me.org_name or me.name} rated you {body.score}/5",
           body.comment, f"/profile/{me.id}", email=False)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "You have already rated this handover") from None
    return {"success": True, "message": "Thank you for your rating"}


@router.get("/user/{user_id}")
def user_ratings(user_id: int, db: Session = Depends(get_db)):
    """Public: average, count and the latest written comments. Raters appear by first name only."""
    user = db.get(User, user_id)
    if not user or user.role == "admin":
        raise HTTPException(404, "User not found")
    avg, count = db.query(func.avg(Rating.score), func.count(Rating.id)).filter(Rating.ratee_id == user_id).one()
    rows = (db.query(Rating).filter(Rating.ratee_id == user_id, Rating.comment.isnot(None))
            .order_by(Rating.created_at.desc()).limit(20).all())
    return {"success": True, "user": {"id": user.id, "name": user.org_name or user.name, "role": user.role, "photo": user.photo},
            "average": round(float(avg), 2) if avg is not None else None, "count": count,
            "recent": [{"score": r.score, "comment": r.comment, "from": (r.rater.name or "").split(" ")[0],
                        "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]}
