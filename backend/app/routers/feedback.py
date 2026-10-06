"""Messages to the admin about the platform. The admin reads and answers them under /api/admin/feedback."""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Feedback, FoodRequest, User
from app.utils.uploads import save_upload

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("")
async def submit_feedback(
    comment:      str            = Form(...),
    request_id:   int            = Form(0),
    rating:       Optional[int]  = Form(None),
    image:        Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    if me.role == "admin":
        raise HTTPException(403, "The admin reads feedback, they do not send it")
    if not comment.strip():
        raise HTTPException(400, "Comment is required")
    if rating is not None and not 1 <= rating <= 5:
        raise HTTPException(400, "Rating must be 1 to 5")

    if request_id:
        req = db.get(FoodRequest, request_id)
        if not req or me.id not in (req.recipient_id, req.listing.donor_id):
            raise HTTPException(404, "Request not found or access denied")
        if req.status != "completed":
            raise HTTPException(400, "Feedback can only be attached to a completed handover")
        if db.query(Feedback).filter(Feedback.request_id == request_id, Feedback.recipient_id == me.id).first():
            raise HTTPException(400, "Feedback already submitted for this request")

    image_path = None
    if image and image.filename:
        image_path = await save_upload(image, prefix="feedback")

    db.add(Feedback(request_id=request_id or None, recipient_id=me.id, comment=comment.strip(),
                    rating=rating, image_path=image_path))
    db.commit()
    return {"success": True, "message": "Feedback submitted successfully", "image_path": image_path}
