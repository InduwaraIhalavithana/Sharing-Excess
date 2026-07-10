from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Numeric,
    ForeignKey, Enum as SAEnum, func,
)
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id                = Column(Integer, primary_key=True, index=True)
    name              = Column(String(255), nullable=False)
    email             = Column(String(255), unique=True, nullable=False, index=True)
    password          = Column(String(255), nullable=False)
    role              = Column(SAEnum("donor", "recipient", "officer", "admin", name="user_role"), nullable=False, default="recipient")
    phone_number      = Column(String(20), nullable=True)
    location          = Column(String(255), nullable=True)
    status            = Column(SAEnum("pending", "active", "suspended", name="user_status"), nullable=False, default="pending")
    verification_code = Column(String(10), nullable=True)
    created_at        = Column(DateTime, server_default=func.now())
    updated_at        = Column(DateTime, onupdate=func.now())

    listings = relationship("FoodListing", back_populates="donor", foreign_keys="FoodListing.donor_id")
    requests = relationship("FoodRequest", back_populates="recipient", foreign_keys="FoodRequest.recipient_id")
    feedback = relationship("Feedback", back_populates="recipient")


class FoodListing(Base):
    __tablename__ = "food_listings"

    id            = Column(Integer, primary_key=True, index=True)
    donor_id      = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    food_name     = Column(String(255), nullable=False)
    quantity      = Column(String(100), nullable=False)
    expiry_date   = Column(String(20), nullable=True)
    location      = Column(String(255), nullable=True)
    description   = Column(Text, nullable=True)
    contact_phone = Column(String(20), nullable=True)
    contact_email = Column(String(255), nullable=True)
    image_path    = Column(String(500), nullable=True)
    status        = Column(
        SAEnum("available", "requested", "accepted", "reserved", "picked_up", "completed", "cancelled",
               name="listing_status"),
        nullable=False, default="available"
    )
    accepted_by   = Column(String(255), nullable=True)
    requested_by  = Column(Integer, nullable=True)
    # Officer verification gate: new listings wait for review before going public
    verification_status = Column(String(20), nullable=False, server_default="pending_review")
    rejection_reason    = Column(Text, nullable=True)
    created_at    = Column(DateTime, server_default=func.now())

    donor    = relationship("User", back_populates="listings", foreign_keys=[donor_id])
    requests = relationship("FoodRequest", back_populates="listing")


class FoodRequest(Base):
    __tablename__ = "food_requests"

    id           = Column(Integer, primary_key=True, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    food_name    = Column(String(255), nullable=False)
    quantity     = Column(String(100), nullable=False)
    needed_by    = Column(String(20), nullable=True)
    location     = Column(String(255), nullable=True)
    description  = Column(Text, nullable=True)
    image_path   = Column(String(500), nullable=True)
    listing_id   = Column(Integer, ForeignKey("food_listings.id"), nullable=True, index=True)
    status       = Column(
        SAEnum("pending", "accepted", "declined", "quality_checked", "delivering",
               "delivered", "picked_up", "cancelled", name="request_status"),
        nullable=False, default="pending"
    )
    accepted_by  = Column(String(255), nullable=True)
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, onupdate=func.now())

    recipient = relationship("User", back_populates="requests", foreign_keys=[recipient_id])
    listing   = relationship("FoodListing", back_populates="requests")
    feedback  = relationship("Feedback", back_populates="request")



class Feedback(Base):
    __tablename__ = "feedback"

    id              = Column(Integer, primary_key=True, index=True)
    request_id      = Column(Integer, ForeignKey("food_requests.id"), nullable=True, index=True)
    recipient_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    comment         = Column(Text, nullable=False)
    rating          = Column(Integer, nullable=True)
    image_path      = Column(String(500), nullable=True)
    admin_reply     = Column(Text, nullable=True)
    feedback_status = Column(String(10), nullable=False, server_default="open")
    created_at      = Column(DateTime, server_default=func.now())

    recipient = relationship("User", back_populates="feedback")
    request   = relationship("FoodRequest", back_populates="feedback")


class Escalation(Base):
    __tablename__ = "escalations"

    id          = Column(Integer, primary_key=True, index=True)
    raised_by   = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    target_type = Column(String(20), nullable=False)   # "user" | "listing" | "request" | "feedback"
    target_id   = Column(Integer, nullable=False)
    reason      = Column(Text, nullable=False)
    status      = Column(String(20), nullable=False, server_default="open")  # open | actioned | dismissed
    admin_note  = Column(Text, nullable=True)
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, onupdate=func.now())

    officer = relationship("User", foreign_keys=[raised_by])


class MoneyDonation(Base):
    __tablename__ = "money_donations"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(255), nullable=False)
    email      = Column(String(255), nullable=False, index=True)
    amount     = Column(Numeric(12, 2), nullable=False)
    card_last4 = Column(String(4), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
