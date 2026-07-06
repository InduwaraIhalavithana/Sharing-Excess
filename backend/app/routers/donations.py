from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MoneyDonation
from app.schemas import MoneyDonationRequest
from app.utils.email import send_email, money_donation_email

router = APIRouter(prefix="/api/donations", tags=["donations"])


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
