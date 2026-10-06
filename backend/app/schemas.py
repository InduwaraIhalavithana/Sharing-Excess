from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator, model_validator

# ── Auth ─────────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "recipient"
    phone_number: str = ""
    location: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str



class VerifyEmailRequest(BaseModel):
    user_id: int
    code: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str


class ProfileUpdate(BaseModel):
    name: str
    phone_number: str = ""
    location: str = ""

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not 2 <= len(v) <= 100:
            raise ValueError("Name must be 2-100 characters")
        return v

    @field_validator("phone_number")
    @classmethod
    def _phone(cls, v: str) -> str:
        v = v.strip()
        if v and not (7 <= len(v) <= 20 and all(ch.isdigit() or ch in "+- ()" for ch in v)):
            raise ValueError("Enter a valid phone number")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ── User ─────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    phone_number: Optional[str] = None
    location: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    phone_number: Optional[str] = None
    location: Optional[str] = None


# ── Listings ─────────────────────────────────────────────────────────────────

class ListingOut(BaseModel):
    id: int
    donor_id: int
    food_name: str
    quantity: str
    expiry_date: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    image_path: Optional[str] = None
    status: str
    accepted_by: Optional[str] = None
    requested_by: Optional[int] = None
    created_at: Optional[datetime] = None
    donor_name: Optional[str] = None

    class Config:
        from_attributes = True


class ListingUpdate(BaseModel):
    food_name: Optional[str] = None
    quantity: Optional[str] = None
    expiry_date: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


# ── Requests ─────────────────────────────────────────────────────────────────

class RequestOut(BaseModel):
    id: int
    recipient_id: int
    food_item: str           # maps to food_name — frontend uses "food_item"
    quantity: str
    needed_by: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    image_path: Optional[str] = None
    listing_id: Optional[int] = None
    status: str
    accepted_by: Optional[str] = None
    created_at: Optional[datetime] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_phone: Optional[str] = None
    recipient_location: Optional[str] = None
    donor_id: Optional[int] = None
    donor_name: Optional[str] = None
    donor_phone: Optional[str] = None

    class Config:
        from_attributes = True


class RespondRequest(BaseModel):
    request_id: int
    status: str   # "accepted" | "declined"
    user_id: int = 0
    user_name: str = ""


class UpdateDeliveryStatus(BaseModel):
    request_id: int
    status: str


class RequestUpdate(BaseModel):
    status: Optional[str] = None
    accepted_by: Optional[str] = None


# ── Feedback ─────────────────────────────────────────────────────────────────

class FeedbackOut(BaseModel):
    id: int
    request_id: Optional[int] = None
    recipient_id: int
    recipient_name: str = "Anonymous"
    rating: Optional[int] = None
    comment: str
    image_path: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Donations ────────────────────────────────────────────────────────────────

class MoneyDonationRequest(BaseModel):
    name: str
    email: EmailStr
    amount: float
    card_last4: str = ""

    @field_validator("card_last4")
    @classmethod
    def validate_card(cls, v: str) -> str:
        if v and (not v.isdigit() or len(v) != 4):
            raise ValueError("card_last4 must be exactly 4 digits")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class PayhereInitiateRequest(BaseModel):
    name: str
    email: EmailStr
    amount: float
    phone: str = ""
    address: str = ""
    city: str = ""

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


# ── Contact ──────────────────────────────────────────────────────────────────

class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str = ""
    message: str


# ── Calendar ─────────────────────────────────────────────────────────────────

class CalendarParticipant(BaseModel):
    id: int
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class CalendarEvent(BaseModel):
    id: str
    title: str
    date: Optional[str] = None
    quantity: Optional[str] = None
    type: str
    status: str
    location: Optional[str] = None
    notes: Optional[str] = None
    donor: Optional[CalendarParticipant] = None
    recipient: Optional[CalendarParticipant] = None


# ── Officer stats ─────────────────────────────────────────────────────────────

class OfficerStats(BaseModel):
    total_requests: int
    total_listings: int
    total_users: int
    total_money_donations: int
    requests_by_status: dict
    users_by_role: dict
    top_requested_foods: list
    donations_by_month: list


# ── Community events ─────────────────────────────────────────────────────────
class EventIn(BaseModel):
    title: str
    description: str = ""
    location: str
    starts_at: datetime
    ends_at: Optional[datetime] = None
    capacity: Optional[int] = None

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        v = v.strip()
        if not 3 <= len(v) <= 200:
            raise ValueError("Title must be 3-200 characters")
        return v

    @field_validator("location")
    @classmethod
    def _location(cls, v: str) -> str:
        v = v.strip()
        if not 2 <= len(v) <= 255:
            raise ValueError("Location must be 2-255 characters")
        return v

    @field_validator("description")
    @classmethod
    def _description(cls, v: str) -> str:
        v = v.strip()
        if len(v) > 2000:
            raise ValueError("Description must be 2000 characters or fewer")
        return v

    @field_validator("capacity")
    @classmethod
    def _capacity(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not 1 <= v <= 10000:
            raise ValueError("Capacity must be between 1 and 10000 (leave empty for unlimited)")
        return v

    @model_validator(mode="after")
    def _order(self):
        if self.ends_at is not None and self.ends_at <= self.starts_at:
            raise ValueError("The event must end after it starts")
        return self


class SubscribeRequest(BaseModel):
    email: EmailStr
