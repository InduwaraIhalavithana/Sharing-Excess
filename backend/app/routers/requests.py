"""Food requests: a recipient (or approved NGO) asks for part or all of a listing; the donor accepts or declines.

Stock is held the moment the request is made and handed back on decline / cancel / no-show / expiry
(see app.services.stock). Contact details are exchanged only once the donor has accepted.
"""
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, is_admin, require_requester
from app.models import FoodListing, FoodRequest, Rating, User
from app.schemas import RequestCreate, RespondRequest, StatusUpdate
from app.services import stock
from app.services.notifications import notify, schedule_emails
from app.utils.timeutil import now_colombo

router = APIRouter(prefix="/api/requests", tags=["requests"])

REQUEST_STATUSES = ("pending", "accepted", "declined", "cancelled", "collected", "completed", "no_show", "expired")
SHARED = ("accepted", "collected", "completed")

# status -> who may move a request there, from which statuses
#   (actor: "donor" | "recipient")
TRANSITIONS: dict[str, dict[str, set[str]]] = {
    "cancelled": {"recipient": {"pending", "accepted"}, "donor": {"accepted"}},
    "collected": {"donor": {"accepted"}, "recipient": {"accepted"}},
    "completed": {"donor": {"accepted", "collected"}, "recipient": {"collected"}},
    "no_show":   {"donor": {"accepted"}},
}


def _fmt(q: Decimal) -> str:
    return f"{q:g}"


def request_out(r: FoodRequest, me: User, rated: Optional[set[int]] = None) -> dict:
    """What `me` may see of a request. Each side gets the other's contact details only after acceptance."""
    listing = r.listing
    is_recipient = r.recipient_id == me.id
    is_donor = listing.donor_id == me.id
    shared = r.status in SHARED
    out = {
        "id": r.id,
        "listing": {
            "id": listing.id, "food_name": listing.food_name, "unit": listing.unit, "district": listing.district,
            "area": listing.area, "image": (listing.images or [None])[0], "status": listing.status,
            "expires_at": listing.expires_at.isoformat(), "fulfilment": listing.fulfilment,
        },
        "quantity_requested": float(r.quantity_requested),
        "message": r.message,
        "status": r.status,
        "decline_reason": r.decline_reason,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "responded_at": r.responded_at.isoformat() if r.responded_at else None,
        "collected_at": r.collected_at.isoformat() if r.collected_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        "recipient": {"id": r.recipient_id, "name": r.recipient.name,
                      "kind": "ngo" if r.recipient.role == "ngo" else "person",
                      "org_name": r.recipient.org_name, "district": r.recipient.district},
        "donor": {"id": listing.donor_id, "name": listing.donor.name},
        "i_am": "recipient" if is_recipient else "donor" if is_donor else "admin",
        "can_rate": r.status == "completed" and (is_recipient or is_donor) and r.id not in (rated or set()),
    }
    if shared and is_donor:
        out["recipient"]["phone"] = r.recipient.phone_number
        out["recipient"]["email"] = r.recipient.email
    if shared and is_recipient:
        out["donor"]["phone"] = listing.contact_phone or listing.donor.phone_number
        out["donor"]["email"] = listing.donor.email
        out["donor"]["address"] = listing.pickup_address or listing.area
    return out


def _rated_ids(db: Session, me: User, ids: list[int]) -> set[int]:
    if not ids:
        return set()
    return {x[0] for x in db.query(Rating.request_id).filter(Rating.rater_id == me.id, Rating.request_id.in_(ids)).all()}


@router.get("")
def get_requests(
    status: Optional[str] = None,
    listing_id: Optional[int] = None,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    """Recipients/NGOs: the requests they made. Donors: requests on their listings. Admin: all (no contact details)."""
    stock.run_expiry(db)
    q = db.query(FoodRequest)
    if me.role in ("recipient", "ngo"):
        q = q.filter(FoodRequest.recipient_id == me.id)
    elif me.role == "donor":
        q = q.join(FoodListing, FoodRequest.listing_id == FoodListing.id).filter(FoodListing.donor_id == me.id)
    elif not is_admin(me):
        raise HTTPException(403, "Not allowed")
    if listing_id:
        q = q.filter(FoodRequest.listing_id == listing_id)
    if status:
        wanted = [x.strip() for x in status.split(",") if x.strip()]
        if not wanted or any(x not in REQUEST_STATUSES for x in wanted):
            raise HTTPException(400, "Unknown status")
        q = q.filter(FoodRequest.status.in_(wanted))
    rows = q.order_by(FoodRequest.created_at.desc(), FoodRequest.id.desc()).limit(500).all()
    rated = _rated_ids(db, me, [r.id for r in rows])
    return {"success": True, "requests": [request_out(r, me, rated) for r in rows]}


@router.get("/{request_id}")
def get_request(request_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    r = db.get(FoodRequest, request_id)
    if not r or not (is_admin(me) or r.recipient_id == me.id or r.listing.donor_id == me.id):
        raise HTTPException(404, "Request not found")   # 404, not 403: don't confirm it exists
    return {"success": True, "request": request_out(r, me, _rated_ids(db, me, [r.id]))}


@router.post("")
def add_request(body: RequestCreate, background: BackgroundTasks, db: Session = Depends(get_db),
                me: User = Depends(require_requester)):
    stock.run_expiry(db)
    listing = stock.lock_listing(db, body.listing_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
    if listing.donor_id == me.id:
        raise HTTPException(400, "You cannot request your own food")
    if listing.status != "active" or listing.expires_at <= now_colombo():
        raise HTTPException(400, "This food is no longer available")
    if db.query(func.count(FoodRequest.id)).filter(
            FoodRequest.listing_id == listing.id, FoodRequest.recipient_id == me.id,
            FoodRequest.status.in_(("pending", "accepted"))).scalar():
        raise HTTPException(409, "You already have an open request for this listing")
    if body.quantity_requested > listing.quantity_available:
        raise HTTPException(400, f"Only {_fmt(listing.quantity_available)} {listing.unit} left")

    req = FoodRequest(recipient_id=me.id, listing_id=listing.id, quantity_requested=body.quantity_requested,
                      message=body.message or None, status="pending")
    db.add(req)
    stock.hold(listing, body.quantity_requested)
    who = me.org_name or me.name
    notify(db, listing.donor, "request_received", f"{who} requested your food",
           f"{_fmt(body.quantity_requested)} {listing.unit} of {listing.food_name}"
           + (f' – "{body.message}"' if body.message else ""), "/dashboard/requests",
           details=[("Quantity", f"{_fmt(body.quantity_requested)} {listing.unit}")])
    db.commit()
    db.refresh(req)
    schedule_emails(background, db)
    return {"success": True, "message": "Request sent - the quantity is held for you until the donor answers",
            "request": request_out(req, me)}


def _load_locked(db: Session, request_id: int) -> tuple[FoodRequest, FoodListing]:
    pair = stock.lock_request(db, request_id)
    if not pair:
        raise HTTPException(404, "Request not found")
    return pair


@router.put("/{request_id}/respond")
def respond_to_request(request_id: int, body: RespondRequest, background: BackgroundTasks,
                       db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    if body.status not in ("accepted", "declined"):
        raise HTTPException(400, "status must be 'accepted' or 'declined'")
    reason = body.reason.strip()
    if body.status == "declined" and not reason:
        raise HTTPException(400, "Please give a reason for declining")
    stock.run_expiry(db)
    req, listing = _load_locked(db, request_id)
    if listing.donor_id != me.id:
        if req.recipient_id == me.id or is_admin(me):
            raise HTTPException(403, "Only the donor can answer this request")
        raise HTTPException(404, "Request not found")
    if req.status != "pending":
        raise HTTPException(400, f"This request is already {req.status}")

    req.status = body.status
    req.responded_at = now_colombo()
    recipient = req.recipient
    qty = f"{_fmt(req.quantity_requested)} {listing.unit}"
    if body.status == "accepted":
        phone = listing.contact_phone or me.phone_number
        notify(db, recipient, "request_accepted", "Your food request was accepted",
               f"{qty} of {listing.food_name} is yours. Contact {me.name} to arrange {listing.fulfilment}.",
               "/dashboard/requests",
               details=[("Donor", me.name), ("Phone", phone or ""), ("Email", me.email),
                        ("Address", listing.pickup_address or listing.area or listing.district)])
        message = "Request accepted - your contact details are now shared with the recipient"
    else:
        req.decline_reason = reason
        stock.release(listing, req.quantity_requested)
        notify(db, recipient, "request_declined", "Your food request was declined",
               f"{qty} of {listing.food_name}. Reason: {reason}", "/dashboard/requests",
               details=[("Reason", reason)])
        message = "Request declined - the quantity is back on the listing"
    db.commit()
    schedule_emails(background, db)
    return {"success": True, "message": message, "request": request_out(req, me)}


@router.put("/{request_id}/status")
def update_status(request_id: int, body: StatusUpdate, background: BackgroundTasks,
                  db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Handover progress: collected / completed / no_show, or cancelled (which returns the stock)."""
    if body.status not in TRANSITIONS:
        raise HTTPException(400, "status must be one of: " + ", ".join(sorted(TRANSITIONS)))
    stock.run_expiry(db)
    req, listing = _load_locked(db, request_id)
    if req.recipient_id == me.id:
        actor = "recipient"
    elif listing.donor_id == me.id:
        actor = "donor"
    else:
        raise HTTPException(404, "Request not found")
    allowed_from = TRANSITIONS[body.status].get(actor)
    if allowed_from is None:
        raise HTTPException(403, f"The {actor} cannot mark a request as {body.status}")
    if req.status not in allowed_from:
        raise HTTPException(400, f"A {req.status} request cannot be marked {body.status}")

    now = now_colombo()
    req.status = body.status
    other = listing.donor if actor == "recipient" else req.recipient
    qty = f"{_fmt(req.quantity_requested)} {listing.unit}"
    who = me.org_name or me.name
    if body.status == "cancelled":
        req.decline_reason = body.reason.strip() or None
        stock.release(listing, req.quantity_requested)
        notify(db, other, "request_cancelled", f"{who} cancelled the request",
               f"{qty} of {listing.food_name} is back on the listing.", "/dashboard/requests")
    elif body.status == "no_show":
        stock.release(listing, req.quantity_requested)
        notify(db, other, "request_no_show", "You were marked as not collecting the food",
               f"{listing.food_name} ({qty}). If this is a mistake, contact the donor.", "/dashboard/requests")
    elif body.status == "collected":
        req.collected_at = now
        notify(db, other, "request_collected", f"{who} marked the food as collected", f"{listing.food_name} ({qty})",
               "/dashboard/requests")
    else:
        req.completed_at = now
        req.collected_at = req.collected_at or now
        notify(db, other, "request_completed", "Handover completed - please leave a rating",
               f"{listing.food_name} ({qty})", "/dashboard/requests")
    db.commit()
    schedule_emails(background, db)
    return {"success": True, "message": "Status updated", "request": request_out(req, me, _rated_ids(db, me, [req.id]))}
