from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Feedback, FoodRequest, User
from app.utils.uploads import save_upload

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.get("")
def get_feedback(db: Session = Depends(get_db)):
    rows = db.query(Feedback).order_by(Feedback.created_at.desc()).all()
    return {"success": True, "feedback": [
        {
            "id":             f.id,
            "request_id":     f.request_id,
            "recipient_id":   f.recipient_id,
            "recipient_name": f.recipient.name if f.recipient else "Anonymous",
            "rating":         f.rating,
            "comment":        f.comment,
            "image_path":     f.image_path,
            "created_at":     f.created_at,
        }
        for f in rows
    ]}


@router.post("")
async def submit_feedback(
    comment:      str            = Form(...),
    request_id:   int            = Form(0),
    rating:       Optional[int]  = Form(None),
    image:        Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    recipient_id = me.id
    if not comment.strip():
        raise HTTPException(400, "Comment is required")

    if request_id:
        req = db.query(FoodRequest).filter(
            FoodRequest.id == request_id,
            FoodRequest.recipient_id == recipient_id,
        ).first()
        if not req:
            raise HTTPException(404, "Request not found or access denied")
        if req.status != "delivered":
            raise HTTPException(400, "Feedback can only be submitted for delivered requests")
        existing = db.query(Feedback).filter(
            Feedback.request_id == request_id,
            Feedback.recipient_id == recipient_id,
        ).first()
        if existing:
            raise HTTPException(400, "Feedback already submitted for this request")

    image_path = None
    if image and image.filename:
        image_path = await save_upload(image, prefix="feedback")

    fb = Feedback(
        request_id=request_id or None,
        recipient_id=recipient_id,
        comment=comment.strip(),
        rating=rating,
        image_path=image_path,
    )
    db.add(fb)
    db.commit()
    return {"success": True, "message": "Feedback submitted successfully", "image_path": image_path}
