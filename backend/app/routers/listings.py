"""Food listings: donors post, everybody browses (nearest district first), contact details stay private."""
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from app.constants import CATEGORIES, FULFILMENT, NEIGHBOURS, proximity_tier
from app.database import get_db
from app.dependencies import get_current_user, is_admin, optional_user, require_roles
from app.models import FoodListing, FoodRequest, Rating, User
from app.schemas import ListingUpdate, ReasonBody, validate_district, validate_phone, validate_text, validate_unit
from app.services import stock
from app.services.notifications import announce_listing, notify, schedule_emails
from app.utils.params import district_list, one_district
from app.utils.timeutil import COLOMBO, now_colombo
from app.utils.uploads import delete_upload, save_upload

router = APIRouter(prefix="/api/listings", tags=["listings"])

MAX_IMAGES = 3
MAX_DAYS_AHEAD = 30
LISTING_STATUSES = ("active", "sold_out", "expired", "closed")
TIER_LABEL = {0: "same_district", 1: "neighbouring", 2: "other"}
SHARED_STATUSES = ("accepted", "collected", "completed")  # the donor said yes: contact details may be shown


def parse_when(value: str, field: str) -> datetime:
    """ISO date-time from a form field -> naive Sri Lanka local time."""
    try:
        dt = datetime.fromisoformat(value.strip())
    except ValueError:
        raise HTTPException(400, f"{field} must be a date and time, e.g. 2026-10-08T18:30") from None
    if dt.tzinfo is not None:
        dt = dt.astimezone(COLOMBO).replace(tzinfo=None)
    return dt


def donor_contact(listing: FoodListing) -> dict:
    d = listing.donor
    return {"name": d.name if d else None, "phone": listing.contact_phone or (d.phone_number if d else None),
            "email": d.email if d else None, "address": listing.pickup_address or listing.area}


def ratings_for(db: Session, user_ids: list[int]) -> dict[int, dict]:
    if not user_ids:
        return {}
    rows = (db.query(Rating.ratee_id, func.avg(Rating.score), func.count(Rating.id))
            .filter(Rating.ratee_id.in_(user_ids)).group_by(Rating.ratee_id).all())
    return {uid: {"average": round(float(avg), 2), "count": n} for uid, avg, n in rows}


def listing_out(item: FoodListing, *, me: Optional[User] = None, near: Optional[str] = None,
                ratings: Optional[dict] = None, shared: bool = False) -> dict:
    """Public shape. `private` (the donor, or the admin) adds the address and phone; `shared` (a recipient whose
    request was accepted) adds the donor's contact block. Nobody else ever receives them."""
    private = bool(me and (is_admin(me) or me.id == item.donor_id))
    out = {
        "id": item.id,
        "donor_id": item.donor_id,
        "donor_name": item.donor.name if item.donor else None,
        "donor_photo": item.donor.photo if item.donor else None,
        "donor_rating": (ratings or {}).get(item.donor_id),
        "food_name": item.food_name,
        "description": item.description,
        "category": item.category,
        "quantity_total": float(item.quantity_total),
        "quantity_available": float(item.quantity_available),
        "unit": item.unit,
        "district": item.district,
        "area": item.area,
        "expires_at": item.expires_at.isoformat(),
        "prepared_at": item.prepared_at.isoformat() if item.prepared_at else None,
        "fulfilment": item.fulfilment,
        "images": list(item.images or []),
        "status": item.status,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "proximity": TIER_LABEL[proximity_tier(near, item.district)] if near else None,
    }
    if private:
        out["pickup_address"] = item.pickup_address
        out["contact_phone"] = item.contact_phone or (item.donor.phone_number if item.donor else None)
        out["safety_confirmed"] = item.safety_confirmed
    if shared:
        out["contact"] = donor_contact(item)
    return out


def _shared_listing_ids(db: Session, me: Optional[User], ids: list[int]) -> set[int]:
    if not me or not ids:
        return set()
    return {r[0] for r in db.query(FoodRequest.listing_id).filter(
        FoodRequest.recipient_id == me.id, FoodRequest.listing_id.in_(ids),
        FoodRequest.status.in_(SHARED_STATUSES)).all()}


@router.get("")
def get_listings(
    district: Optional[str] = None,       # filter: one or several, comma-separated
    near: Optional[str] = None,           # whose neighbourhood to sort by (default: the signed-in user's district)
    category: Optional[str] = None,
    fulfilment: Optional[str] = None,
    q: Optional[str] = None,
    donor_id: Optional[int] = None,       # "my listings": the donor themself or the admin
    status: Optional[str] = None,         # only with donor_id (donors see their own sold-out / expired / closed ones)
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    me: Optional[User] = Depends(optional_user),
):
    stock.run_expiry(db)
    limit = max(1, min(limit, 100))
    query = db.query(FoodListing)
    if donor_id:
        if me is None:
            raise HTTPException(401, "Not authenticated")
        if me.id != donor_id and not is_admin(me):
            raise HTTPException(403, "You can only view your own listings")
        query = query.filter(FoodListing.donor_id == donor_id)
        if status:
            if status not in LISTING_STATUSES:
                raise HTTPException(400, "Unknown status")
            query = query.filter(FoodListing.status == status)
    else:
        query = query.filter(FoodListing.status == "active", FoodListing.expires_at > now_colombo(),
                             FoodListing.quantity_available > 0)
    if district:
        wanted = district_list(district)
        query = query.filter(FoodListing.district.in_(wanted))
    if category:
        if category not in CATEGORIES:
            raise HTTPException(400, "Unknown food category")
        query = query.filter(FoodListing.category == category)
    if fulfilment:
        if fulfilment not in FULFILMENT:
            raise HTTPException(400, "fulfilment must be pickup, delivery or both")
        query = query.filter(or_(FoodListing.fulfilment == fulfilment, FoodListing.fulfilment == "both"))
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(FoodListing.food_name.ilike(like) | FoodListing.description.ilike(like)
                             | FoodListing.area.ilike(like) | FoodListing.district.ilike(like))

    home = one_district(near) if near else (me.district if me else None)
    total = query.count()
    if home:
        tier = case((FoodListing.district == home, 0),
                    (FoodListing.district.in_(sorted(NEIGHBOURS.get(home, ()))), 1), else_=2)
        # same district first, then neighbours, then the rest; within each, the food that spoils first
        query = query.order_by(tier, FoodListing.expires_at.asc(), FoodListing.id.desc())
    elif donor_id:
        query = query.order_by(FoodListing.created_at.desc(), FoodListing.id.desc())
    else:
        query = query.order_by(FoodListing.expires_at.asc(), FoodListing.id.desc())
    rows = query.offset((max(page, 1) - 1) * limit).limit(limit).all()

    ratings = ratings_for(db, list({r.donor_id for r in rows}))
    shared = _shared_listing_ids(db, me, [r.id for r in rows])
    return {"success": True, "total": total, "page": page, "limit": limit, "near": home,
            "listings": [listing_out(r, me=me, near=home, ratings=ratings, shared=r.id in shared) for r in rows]}


@router.get("/{listing_id}")
def get_listing(listing_id: int, db: Session = Depends(get_db), me: Optional[User] = Depends(optional_user)):
    stock.run_expiry(db)
    item = db.get(FoodListing, listing_id)
    owner_or_admin = bool(me and (is_admin(me) or me.id == item.donor_id)) if item else False
    if not item or (item.status == "closed" and not owner_or_admin):
        raise HTTPException(404, "Listing not found")
    ratings = ratings_for(db, [item.donor_id])
    shared = listing_id in _shared_listing_ids(db, me, [listing_id])
    return {"success": True, "listing": listing_out(item, me=me, near=me.district if me else None,
                                                    ratings=ratings, shared=shared)}


@router.post("")
async def add_listing(
    background:       BackgroundTasks,
    food_name:        str   = Form(...),
    category:         str   = Form(...),
    quantity_total:   str   = Form(...),
    unit:             str   = Form(...),
    district:         str   = Form(...),
    expires_at:       str   = Form(...),
    safety_confirmed: bool  = Form(False),
    description:      str   = Form(""),
    area:             str   = Form(""),
    pickup_address:   str   = Form(""),
    contact_phone:    str   = Form(""),
    prepared_at:      str   = Form(""),
    fulfilment:       str   = Form("pickup"),
    images:           list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    me: User = Depends(require_roles("donor")),
):
    """Goes live immediately - no review step. Needs 1-3 photos and the donor's safety confirmation."""
    if not safety_confirmed:
        raise HTTPException(400, "Please confirm that this food is safe to eat and not expired")
    try:
        food_name = validate_text(food_name, "Food name", 2, 255)
        description = validate_text(description, "Description", 0, 2000)
        area = validate_text(area, "Area", 0, 120)
        pickup_address = validate_text(pickup_address, "Pickup address", 0, 500)
        contact_phone = validate_phone(contact_phone)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None
    if category not in CATEGORIES:
        raise HTTPException(400, "Unknown food category")
    if fulfilment not in FULFILMENT:
        raise HTTPException(400, "fulfilment must be pickup, delivery or both")
    try:
        qty = Decimal(quantity_total).quantize(Decimal("0.01"))
    except InvalidOperation:
        raise HTTPException(400, "Quantity must be a number") from None
    if not qty.is_finite():
        raise HTTPException(400, "Quantity must be a number")
    try:
        unit = validate_unit(unit)
        district = validate_district(district)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None
    if not Decimal("0") < qty <= Decimal("100000"):
        raise HTTPException(400, "Quantity must be more than 0")
    expires = parse_when(expires_at, "expires_at")
    now = now_colombo()
    if expires <= now:
        raise HTTPException(400, "The expiry time must be in the future")
    if expires > now + timedelta(days=MAX_DAYS_AHEAD):
        raise HTTPException(400, f"Surplus food should be shared within {MAX_DAYS_AHEAD} days")
    prepared = parse_when(prepared_at, "prepared_at") if prepared_at.strip() else None
    if prepared and prepared > now + timedelta(minutes=5):
        raise HTTPException(400, "The preparation time cannot be in the future")

    files = [f for f in images if f and f.filename]
    if not files:
        raise HTTPException(400, "Add at least one photo of the food")
    if len(files) > MAX_IMAGES:
        raise HTTPException(400, f"You can add up to {MAX_IMAGES} photos")
    saved: list[str] = []
    try:
        for f in files:
            saved.append(await save_upload(f, prefix="listing"))
        listing = FoodListing(
            donor_id=me.id, food_name=food_name, description=description.strip() or None, category=category,
            quantity_total=qty, quantity_available=qty, unit=unit, district=district,
            area=area.strip() or None, pickup_address=pickup_address.strip() or None,
            contact_phone=contact_phone.strip() or None, expires_at=expires, prepared_at=prepared,
            fulfilment=fulfilment, images=saved, safety_confirmed=True, status="active",
        )
        db.add(listing)
        db.commit()
    except Exception:
        db.rollback()
        for url in saved:
            delete_upload(url)
        raise
    db.refresh(listing)
    background.add_task(announce_listing, listing.id)
    return {"success": True, "message": "Your listing is live", "listing": listing_out(listing, me=me)}


@router.put("/{listing_id}")
def update_listing(listing_id: int, body: ListingUpdate, db: Session = Depends(get_db),
                   me: User = Depends(require_roles("donor"))):
    listing = stock.lock_listing(db, listing_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
    if listing.donor_id != me.id:
        raise HTTPException(403, "You can only edit your own listings")
    if listing.status == "closed":
        raise HTTPException(400, "This listing is closed")
    changes = body.model_dump(exclude_unset=True)
    if "quantity_total" in changes and changes["quantity_total"] is not None:
        new_total = changes.pop("quantity_total").quantize(Decimal("0.01"))
        held = listing.quantity_total - listing.quantity_available
        if new_total < held:
            raise HTTPException(400, f"{held:g} {listing.unit} is already requested or handed over - "
                                     "the total cannot be lower than that")
        listing.quantity_available = new_total - held
        listing.quantity_total = new_total
    if changes.get("expires_at") is not None:
        exp = changes["expires_at"]
        if exp.tzinfo is not None:
            exp = exp.astimezone(COLOMBO).replace(tzinfo=None)
            changes["expires_at"] = exp
        if exp <= now_colombo():
            raise HTTPException(400, "The expiry time must be in the future")
        if exp > now_colombo() + timedelta(days=MAX_DAYS_AHEAD):
            raise HTTPException(400, f"Surplus food should be shared within {MAX_DAYS_AHEAD} days")
    if "food_name" in changes and not (changes["food_name"] or "").strip():
        raise HTTPException(400, "Food name cannot be empty")
    for field, value in changes.items():
        if value is None and field in ("food_name", "category", "expires_at", "fulfilment"):
            continue
        setattr(listing, field, value.strip() if isinstance(value, str) else value)
    stock.refresh_status(listing)
    db.commit()
    db.refresh(listing)
    return {"success": True, "message": "Listing updated", "listing": listing_out(listing, me=me)}


def close_listing(db: Session, listing: FoodListing, reason: str, by_admin: bool) -> None:
    """Close a listing: unanswered requests are declined (stock returned); accepted ones stay, the handover goes on."""
    stock.finish_pending(db, listing, "declined", reason=reason or "The donor closed this listing",
                         notice="Your food request was declined")
    listing.status = "closed"
    if by_admin and listing.donor:
        notify(db, listing.donor, "listing_removed", "Your listing was removed by the admin",
               f"{listing.food_name}" + (f" – {reason}" if reason else ""), "/dashboard")


@router.post("/{listing_id}/close")
def close(listing_id: int, background: BackgroundTasks, body: ReasonBody = ReasonBody(),
          db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    listing = stock.lock_listing(db, listing_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
    if listing.donor_id != me.id and not is_admin(me):
        raise HTTPException(403, "You can only close your own listings")
    if listing.status == "closed":
        return {"success": True, "message": "This listing is already closed"}
    reason = body.reason.strip()
    close_listing(db, listing, reason, by_admin=is_admin(me) and listing.donor_id != me.id)
    db.commit()
    schedule_emails(background, db)
    return {"success": True, "message": "Listing closed"}


@router.delete("/{listing_id}")
def delete_listing(listing_id: int, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Only a listing nobody ever asked for can be deleted; anything with history is closed instead."""
    listing = stock.lock_listing(db, listing_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
    if listing.donor_id != me.id and not is_admin(me):
        raise HTTPException(403, "You can only delete your own listings")
    if db.query(func.count(FoodRequest.id)).filter(FoodRequest.listing_id == listing_id).scalar():
        raise HTTPException(400, "Someone has already requested this food - close the listing instead")
    photos = list(listing.images or [])
    db.delete(listing)
    db.commit()
    for url in photos:
        delete_upload(url)
    return {"success": True, "message": "Listing deleted"}

