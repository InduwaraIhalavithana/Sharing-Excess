from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Notification, User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _out(n: Notification) -> dict:
    return {"id": n.id, "kind": n.kind, "title": n.title, "body": n.body, "link": n.link,
            "is_read": n.is_read, "created_at": n.created_at.isoformat() if n.created_at else None}


def _unread(db: Session, me: User) -> int:
    return db.query(func.count(Notification.id)).filter(
        Notification.user_id == me.id, Notification.is_read.is_(False)).scalar()


@router.get("")
def list_notifications(unread_only: bool = False, limit: int = 30, db: Session = Depends(get_db),
                       me: User = Depends(get_current_user)):
    q = db.query(Notification).filter(Notification.user_id == me.id)
    if unread_only:
        q = q.filter(Notification.is_read.is_(False))
    rows = q.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(max(1, min(limit, 100))).all()
    return {"success": True, "unread": _unread(db, me), "notifications": [_out(n) for n in rows]}


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    return {"success": True, "unread": _unread(db, me)}


@router.post("/read-all")
def read_all(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.user_id == me.id, Notification.is_read.is_(False)) \
        .update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"success": True}


def _mine(db: Session, me: User, notification_id: int) -> Notification:
    n = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == me.id).first()
    if not n:
        raise HTTPException(404, "Notification not found")
    return n


@router.post("/{notification_id}/read")
def read_one(notification_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    _mine(db, me, notification_id).is_read = True
    db.commit()
    return {"success": True}


@router.delete("/{notification_id}")
def delete_one(notification_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    db.delete(_mine(db, me, notification_id))
    db.commit()
    return {"success": True}
