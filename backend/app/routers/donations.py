import hashlib
import os
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MoneyDonation
from app.schemas import MoneyDonationRequest, PayhereInitiateRequest
from app.utils.email import send_email, money_donation_email

router = APIRouter(prefix="/api/donations", tags=["donations"])

_SANDBOX      = os.getenv("PAYHERE_SANDBOX", "true").lower() != "false"
_MERCHANT_ID  = os.getenv("PAYHERE_MERCHANT_ID", "1211149")
_MERCHANT_SECRET = os.getenv("PAYHERE_MERCHANT_SECRET", "Pay&HeRe")

PAYHERE_CHECKOUT = (
    "https://sandbox.payhere.lk/pay/checkout"
    if _SANDBOX
    else "https://www.payhere.lk/pay/checkout"
)


def _payhere_hash(merchant_id: str, order_id: str, amount: str, currency: str, secret: str) -> str:
    secret_hash = hashlib.md5(secret.encode()).hexdigest().upper()
    raw = f"{merchant_id}{order_id}{amount}{currency}{secret_hash}"
    return hashlib.md5(raw.encode()).hexdigest().upper()


@router.post("/money")
def add_money_donation(body: MoneyDonationRequest, db: Session = Depends(get_db)):
    donation = MoneyDonation(
        name=body.name,
        email=body.email,
        amount=body.amount,
        card_last4=body.card_last4,
    )
    db.add(donation)
    db.commit()

    send_email(
        body.email,
        "Thank You for Your Donation – Sharing Excess",
        money_donation_email(body.name, body.amount),
    )

    return {"success": True}


@router.post("/payhere/initiate")
def payhere_initiate(body: PayhereInitiateRequest):
    order_id  = f"SE-{secrets.token_hex(8).upper()}"
    amount_str = f"{body.amount:.2f}"
    currency   = "LKR"
    ph_hash    = _payhere_hash(_MERCHANT_ID, order_id, amount_str, currency, _MERCHANT_SECRET)

    name_parts = body.name.strip().split(" ", 1)
    first_name = name_parts[0]
    last_name  = name_parts[1] if len(name_parts) > 1 else "-"

    return {
        "success": True,
        "checkout_url": PAYHERE_CHECKOUT,
        "sandbox": _SANDBOX,
        "params": {
            "merchant_id":   _MERCHANT_ID,
            "return_url":    os.getenv("CORS_ORIGIN", "http://localhost:5175") + "/donate?payment=success",
            "cancel_url":    os.getenv("CORS_ORIGIN", "http://localhost:5175") + "/donate?payment=cancelled",
            "notify_url":    os.getenv("CORS_ORIGIN", "http://localhost:5175").replace("5175", "8003") + "/api/donations/payhere/notify",
            "order_id":      order_id,
            "items":         "Sharing Excess Food Donation",
            "currency":      currency,
            "amount":        amount_str,
            "first_name":    first_name,
            "last_name":     last_name,
            "email":         body.email,
            "phone":         body.phone or "0000000000",
            "address":       body.address or "N/A",
            "city":          body.city or "Colombo",
            "country":       "Sri Lanka",
            "hash":          ph_hash,
        },
    }


@router.post("/payhere/notify")
async def payhere_notify():
    """PayHere server-side IPN — extend this to verify & record confirmed payments."""
    return {"status": "ok"}
