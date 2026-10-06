"""Money donations.

Online payments go through PayHere: the browser is sent to PayHere's checkout, and PayHere then
calls /payhere/notify from its own servers. Only that verified server-to-server call records a
donation - the browser returning to /donate?payment=success proves nothing and records nothing.
"""
import hashlib
import hmac
import logging
import secrets
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import require_staff
from app.models import MoneyDonation, User
from app.schemas import MoneyDonationRequest, PayhereInitiateRequest
from app.utils.email import money_donation_email, send_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/donations", tags=["donations"])

_SANDBOX = settings.payhere_sandbox
_MERCHANT_ID = settings.payhere_merchant_id
_MERCHANT_SECRET = settings.payhere_merchant_secret

PAYHERE_CHECKOUT = (
    "https://sandbox.payhere.lk/pay/checkout"
    if _SANDBOX
    else "https://www.payhere.lk/pay/checkout"
)

PAYHERE_SUCCESS = "2"  # PayHere status_code for a completed payment


def _secret_hash(secret: str) -> str:
    return hashlib.md5(secret.encode()).hexdigest().upper()


def _payhere_hash(merchant_id: str, order_id: str, amount: str, currency: str, secret: str) -> str:
    """Checkout hash that tells PayHere the amount was set by us, not edited in the browser."""
    return hashlib.md5(f"{merchant_id}{order_id}{amount}{currency}{_secret_hash(secret)}".encode()).hexdigest().upper()


def _notify_signature(merchant_id: str, order_id: str, amount: str, currency: str, status_code: str, secret: str) -> str:
    """The md5sig PayHere sends with its server-to-server notification."""
    raw = f"{merchant_id}{order_id}{amount}{currency}{status_code}{_secret_hash(secret)}"
    return hashlib.md5(raw.encode()).hexdigest().upper()


@router.post("/money")
def record_offline_donation(body: MoneyDonationRequest, db: Session = Depends(get_db),
                            staff: User = Depends(require_staff)):
    """Staff record a donation received outside the website (cash, bank transfer).

    Staff-only: an open endpoint here would let anyone invent donations and make this server
    send "thank you" emails to any address.
    """
    db.add(MoneyDonation(name=body.name, email=body.email, amount=body.amount,
                         card_last4=body.card_last4 or None, source="manual"))
    db.commit()
    send_email(body.email, "Thank You for Your Donation – Sharing Excess", money_donation_email(body.name, body.amount))
    return {"success": True}


@router.post("/payhere/initiate")
def payhere_initiate(body: PayhereInitiateRequest):
    order_id = f"SE-{secrets.token_hex(8).upper()}"
    amount_str = f"{body.amount:.2f}"
    currency = "LKR"
    ph_hash = _payhere_hash(_MERCHANT_ID, order_id, amount_str, currency, _MERCHANT_SECRET)

    name_parts = body.name.strip().split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else "-"

    return {
        "success": True,
        "checkout_url": PAYHERE_CHECKOUT,
        "sandbox": _SANDBOX,
        "params": {
            "merchant_id": _MERCHANT_ID,
            "return_url": settings.frontend_url + "/donate?payment=success",
            "cancel_url": settings.frontend_url + "/donate?payment=cancelled",
            "notify_url": settings.api_public_url + "/api/donations/payhere/notify",
            "order_id": order_id,
            "items": "Sharing Excess Food Donation",
            "currency": currency,
            "amount": amount_str,
            "first_name": first_name,
            "last_name": last_name,
            "email": body.email,
            "phone": body.phone or "0000000000",
            "address": body.address or "N/A",
            "city": body.city or "Colombo",
            "country": "Sri Lanka",
            # PayHere echoes these back in the notification so we can record who paid
            "custom_1": body.name.strip()[:100],
            "custom_2": str(body.email),
            "hash": ph_hash,
        },
    }


@router.post("/payhere/notify")
def payhere_notify(
    merchant_id: str = Form(...),
    order_id: str = Form(...),
    payhere_amount: str = Form(...),
    payhere_currency: str = Form(...),
    status_code: str = Form(...),
    md5sig: str = Form(...),
    custom_1: str = Form(""),
    custom_2: str = Form(""),
    card_no: str = Form(""),
    db: Session = Depends(get_db),
):
    """PayHere's server-to-server confirmation. Verified by signature, recorded once per order."""
    expected = _notify_signature(merchant_id, order_id, payhere_amount, payhere_currency, status_code, _MERCHANT_SECRET)
    if merchant_id != _MERCHANT_ID or not hmac.compare_digest(expected, md5sig.upper()):
        logger.warning("Rejected PayHere notification for order %s: bad signature", order_id)
        raise HTTPException(400, "Invalid signature")

    if status_code != PAYHERE_SUCCESS:
        return {"status": "ignored"}  # pending / failed / cancelled / charged back: nothing to record

    try:
        amount = Decimal(payhere_amount)
    except InvalidOperation:
        raise HTTPException(400, "Invalid amount") from None
    digits = "".join(ch for ch in card_no if ch.isdigit())
    donation = MoneyDonation(
        name=custom_1 or "Anonymous", email=custom_2 or "unknown@invalid", amount=amount,
        card_last4=digits[-4:] if len(digits) >= 4 else None, source="payhere", payment_ref=order_id,
    )
    db.add(donation)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # PayHere retried a notification we already recorded
        return {"status": "duplicate"}

    if custom_2:
        send_email(custom_2, "Thank You for Your Donation – Sharing Excess", money_donation_email(donation.name, float(amount)))
    return {"status": "ok"}
