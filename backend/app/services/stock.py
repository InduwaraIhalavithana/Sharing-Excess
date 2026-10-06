"""Stock accounting for listings.

A listing's `quantity_available` is what nobody holds yet. A request holds its quantity from the moment it is
made (pending), keeps holding it when accepted / collected / completed, and gives it back when declined,
cancelled, a no-show or expired. Every change happens with the listing row locked (SELECT ... FOR UPDATE), so two
people can never be promised the same food, and the CHECK constraint on the table is the last line of defence.
Lock order is always listing first, then request.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.models import FoodListing, FoodRequest
from app.services.notifications import notify, send_queued_now
from app.utils.timeutil import now_colombo


def lock_listing(db: Session, listing_id: int) -> Optional[FoodListing]:
    return (db.query(FoodListing).filter(FoodListing.id == listing_id)
            .with_for_update().populate_existing().first())


def lock_request(db: Session, request_id: int) -> Optional[tuple[FoodRequest, FoodListing]]:
    """The request and its listing, both locked (listing first)."""
    req = db.get(FoodRequest, request_id)
    if not req:
        return None
    listing = lock_listing(db, req.listing_id)
    req = db.query(FoodRequest).filter(FoodRequest.id == request_id).with_for_update().populate_existing().first()
    return req, listing


def refresh_status(listing: FoodListing, now: Optional[datetime] = None) -> None:
    """active <-> sold_out follow the stock; expired follows the clock; closed is the donor's / admin's decision."""
    if listing.status == "closed":
        return
    now = now or now_colombo()
    if listing.expires_at <= now:
        listing.status = "expired"
    elif listing.quantity_available <= 0:
        listing.status = "sold_out"
    else:
        listing.status = "active"


def hold(listing: FoodListing, qty: Decimal) -> None:
    listing.quantity_available = listing.quantity_available - qty
    refresh_status(listing)


def release(listing: FoodListing, qty: Decimal) -> None:
    listing.quantity_available = min(listing.quantity_total, listing.quantity_available + qty)
    refresh_status(listing)


def finish_pending(db: Session, listing: FoodListing, new_status: str, reason: Optional[str] = None,
                   notice: Optional[str] = None) -> int:
    """Move every unanswered request on a listing to `new_status`, returning its stock."""
    now = now_colombo()
    pending = (db.query(FoodRequest).filter(FoodRequest.listing_id == listing.id, FoodRequest.status == "pending")
               .with_for_update().all())
    for r in pending:
        r.status = new_status
        r.responded_at = now
        if reason:
            r.decline_reason = reason
        release(listing, r.quantity_requested)
        if notice and r.recipient:
            notify(db, r.recipient, f"request_{new_status}", notice,
                   listing.food_name + (f" – {reason}" if reason else ""), "/dashboard/requests")
    return len(pending)


def run_expiry(db: Session) -> int:
    """Mark overdue listings expired and give back what their unanswered requests held. Returns listings expired."""
    now = now_colombo()
    due = (db.query(FoodListing).filter(FoodListing.status.in_(("active", "sold_out")), FoodListing.expires_at <= now)
           .with_for_update(skip_locked=True).all())
    for listing in due:
        finish_pending(db, listing, "expired", notice="Your food request expired")
        listing.status = "expired"
    if due:
        db.commit()
        send_queued_now(db)
    return len(due)
