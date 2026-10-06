from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator, model_validator

from app.constants import CATEGORIES, DISTRICTS, EVENT_TYPES, FULFILMENT, UNITS


def _district(v: str) -> str:
    v = (v or "").strip()
    match = next((d for d in DISTRICTS if d.lower() == v.lower()), None)
    if not match:
        raise ValueError("Choose one of the 25 districts of Sri Lanka")
    return match


def _phone(v: str) -> str:
    v = (v or "").strip()
    if v and not (7 <= len(v) <= 20 and all(ch.isdigit() or ch in "+- ()" for ch in v)):
        raise ValueError("Enter a valid phone number")
    return v


# ── Auth ─────────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "recipient"            # donor | recipient | ngo
    phone_number: str = ""
    location: str = ""
    district: str
    org_name: str = ""                 # NGO accounts
    org_description: str = ""

    @field_validator("district")
    @classmethod
    def _d(cls, v: str) -> str:
        return _district(v)

    @field_validator("phone_number")
    @classmethod
    def _p(cls, v: str) -> str:
        return _phone(v)

    @model_validator(mode="after")
    def _ngo(self):
        if self.role == "ngo" and len(self.org_name.strip()) < 2:
            raise ValueError("An NGO account needs the organisation's name")
        return self


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
    district: Optional[str] = None
    notify_districts: Optional[list[str]] = None
    notify_food_types: Optional[list[str]] = None
    notify_email: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not 2 <= len(v) <= 100:
            raise ValueError("Name must be 2-100 characters")
        return v

    @field_validator("phone_number")
    @classmethod
    def _p(cls, v: str) -> str:
        return _phone(v)

    @field_validator("district")
    @classmethod
    def _d(cls, v: Optional[str]) -> Optional[str]:
        return _district(v) if v else None

    @field_validator("notify_districts")
    @classmethod
    def _nd(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        return None if v is None else sorted({_district(x) for x in v})

    @field_validator("notify_food_types")
    @classmethod
    def _nf(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is None:
            return None
        bad = [x for x in v if x not in CATEGORIES]
        if bad:
            raise ValueError(f"Unknown food type: {bad[0]}")
        return sorted(set(v))


class DeleteAccountRequest(BaseModel):
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ── Listings ─────────────────────────────────────────────────────────────────

class ListingUpdate(BaseModel):
    """Everything is optional; only the fields sent change. Photos are not editable (post a new listing)."""
    food_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    quantity_total: Optional[Decimal] = None
    area: Optional[str] = None
    pickup_address: Optional[str] = None
    contact_phone: Optional[str] = None
    expires_at: Optional[datetime] = None
    prepared_at: Optional[datetime] = None
    fulfilment: Optional[str] = None

    @field_validator("category")
    @classmethod
    def _c(cls, v):
        if v is not None and v not in CATEGORIES:
            raise ValueError("Unknown food category")
        return v

    @field_validator("fulfilment")
    @classmethod
    def _f(cls, v):
        if v is not None and v not in FULFILMENT:
            raise ValueError("fulfilment must be pickup, delivery or both")
        return v

    @field_validator("quantity_total")
    @classmethod
    def _q(cls, v):
        if v is not None and not Decimal("0") < v <= Decimal("100000"):
            raise ValueError("Quantity must be more than 0")
        return v

    @field_validator("contact_phone")
    @classmethod
    def _p(cls, v):
        return None if v is None else _phone(v)


def validate_unit(v: str) -> str:
    v = (v or "").strip().lower()
    if v not in UNITS:
        raise ValueError("Unit must be one of: " + ", ".join(UNITS))
    return v


def validate_district(v: str) -> str:
    return _district(v)


# ── Requests ─────────────────────────────────────────────────────────────────

class RequestCreate(BaseModel):
    listing_id: int
    quantity_requested: Decimal
    message: str = ""

    @field_validator("quantity_requested")
    @classmethod
    def _q(cls, v):
        if not Decimal("0") < v <= Decimal("100000"):
            raise ValueError("Quantity must be more than 0")
        return v.quantize(Decimal("0.01"))

    @field_validator("message")
    @classmethod
    def _m(cls, v):
        v = v.strip()
        if len(v) > 500:
            raise ValueError("Message must be 500 characters or fewer")
        return v


class RespondRequest(BaseModel):
    status: str            # "accepted" | "declined"
    reason: str = ""       # required when declining


class StatusUpdate(BaseModel):
    status: str            # cancelled | collected | completed | no_show
    reason: str = ""


# ── Ratings, reports ─────────────────────────────────────────────────────────

class RatingIn(BaseModel):
    request_id: int
    score: int
    comment: str = ""

    @field_validator("score")
    @classmethod
    def _s(cls, v):
        if not 1 <= v <= 5:
            raise ValueError("Score must be 1 to 5")
        return v

    @field_validator("comment")
    @classmethod
    def _c(cls, v):
        v = v.strip()
        if len(v) > 500:
            raise ValueError("Comment must be 500 characters or fewer")
        return v


class ReportIn(BaseModel):
    target_type: str       # listing | user | event | request
    target_id: int
    reason: str

    @field_validator("target_type")
    @classmethod
    def _t(cls, v):
        if v not in ("listing", "user", "event", "request"):
            raise ValueError("target_type must be listing, user, event or request")
        return v

    @field_validator("reason")
    @classmethod
    def _r(cls, v):
        v = v.strip()
        if not 5 <= len(v) <= 1000:
            raise ValueError("Please describe the problem in 5-1000 characters")
        return v


class ReportUpdate(BaseModel):
    status: str            # open | actioned | dismissed
    admin_note: Optional[str] = None


# ── Admin ────────────────────────────────────────────────────────────────────

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    location: Optional[str] = None
    district: Optional[str] = None
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def _s(cls, v):
        if v is not None and v not in ("active", "suspended"):
            raise ValueError("status must be active or suspended")
        return v

    @field_validator("district")
    @classmethod
    def _d(cls, v):
        return _district(v) if v else None


class ReasonBody(BaseModel):
    reason: str = ""


class FeedbackReply(BaseModel):
    reply: Optional[str] = None


# ── Contact ──────────────────────────────────────────────────────────────────

class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str = ""
    message: str


# ── Community events ─────────────────────────────────────────────────────────

class EventIn(BaseModel):
    title: str
    description: str = ""
    location: str
    district: str
    event_type: str = "other"
    starts_at: datetime
    ends_at: Optional[datetime] = None
    capacity: Optional[int] = None
    contact_name: str
    contact_phone: str = ""
    contact_email: str = ""

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

    @field_validator("district")
    @classmethod
    def _d(cls, v: str) -> str:
        return _district(v)

    @field_validator("event_type")
    @classmethod
    def _type(cls, v: str) -> str:
        if v not in EVENT_TYPES:
            raise ValueError("Unknown event type")
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

    @field_validator("contact_name")
    @classmethod
    def _cn(cls, v: str) -> str:
        v = v.strip()
        if not 2 <= len(v) <= 120:
            raise ValueError("Contact name must be 2-120 characters")
        return v

    @field_validator("contact_phone")
    @classmethod
    def _cp(cls, v: str) -> str:
        return _phone(v)

    @field_validator("contact_email")
    @classmethod
    def _ce(cls, v: str) -> str:
        v = v.strip()
        if v and ("@" not in v or len(v) > 255):
            raise ValueError("Enter a valid contact email")
        return v

    @model_validator(mode="after")
    def _order(self):
        if self.ends_at is not None and self.ends_at <= self.starts_at:
            raise ValueError("The event must end after it starts")
        if not (self.contact_phone or self.contact_email):
            raise ValueError("Give a contact phone or email so people can reach the organiser")
        return self


class SubscribeRequest(BaseModel):
    email: EmailStr
