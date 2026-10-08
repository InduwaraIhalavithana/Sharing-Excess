from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id                = Column(Integer, primary_key=True, index=True)
    name              = Column(String(255), nullable=False)
    email             = Column(String(255), unique=True, nullable=False, index=True)
    password          = Column(String(255), nullable=False)
    role              = Column(SAEnum("donor", "recipient", "ngo", "admin", name="user_role"), nullable=False, default="recipient")
    phone_number      = Column(String(20), nullable=True)
    location          = Column(String(255), nullable=True)      # free-text area / address line
    district          = Column(String(30), nullable=True)       # one of constants.DISTRICTS; drives "nearby first"
    status            = Column(SAEnum("pending", "active", "suspended", name="user_status"), nullable=False, default="pending")
    verification_code = Column(String(10), nullable=True)
    verification_expires_at = Column(DateTime, nullable=True)     # naive UTC; see services/otp.py
    verification_attempts   = Column(Integer, nullable=False, default=0, server_default="0")
    # Notification preferences. Empty list = "no filter": no districts -> own district and its neighbours,
    # no food types -> every type.
    notify_districts  = Column(ARRAY(Text), nullable=False, default=list, server_default="{}")
    notify_food_types = Column(ARRAY(Text), nullable=False, default=list, server_default="{}")
    notify_email      = Column(Boolean, nullable=False, default=True, server_default="true")
    # NGO accounts only
    org_name          = Column(String(200), nullable=True)
    org_description   = Column(Text, nullable=True)
    org_logo          = Column(String(500), nullable=True)
    avatar            = Column(String(500), nullable=True)      # profile photo of a donor or recipient (an NGO's is org_logo)
    ngo_status        = Column(String(20), nullable=True)       # pending | approved | rejected (NULL for other roles)
    created_at        = Column(DateTime, server_default=func.now())
    updated_at        = Column(DateTime, onupdate=func.now())

    listings = relationship("FoodListing", back_populates="donor", foreign_keys="FoodListing.donor_id")
    requests = relationship("FoodRequest", back_populates="recipient", foreign_keys="FoodRequest.recipient_id")
    feedback = relationship("Feedback", back_populates="recipient")

    @property
    def photo(self) -> str | None:
        """The picture shown next to this account: an NGO's logo, otherwise the profile photo."""
        return (self.org_logo or self.avatar) if self.role == "ngo" else self.avatar


class FoodListing(Base):
    __tablename__ = "food_listings"
    __table_args__ = (Index("ix_food_listings_status_expires", "status", "expires_at"),)

    id                 = Column(Integer, primary_key=True, index=True)
    donor_id           = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    food_name          = Column(String(255), nullable=False)
    description        = Column(Text, nullable=True)
    category           = Column(String(30), nullable=False, default="other")
    quantity_total     = Column(Numeric(10, 2), nullable=False)
    quantity_available = Column(Numeric(10, 2), nullable=False)   # total minus what requests hold or consumed
    unit               = Column(String(20), nullable=False, default="portions")
    district           = Column(String(30), nullable=False, index=True)
    area               = Column(String(120), nullable=True)        # public: town / neighbourhood
    pickup_address     = Column(Text, nullable=True)               # private: shown only to an accepted recipient
    contact_phone      = Column(String(20), nullable=True)         # private; falls back to the donor's profile phone
    expires_at         = Column(DateTime, nullable=False)          # Sri Lanka local time
    prepared_at        = Column(DateTime, nullable=True)           # cooked food
    fulfilment         = Column(String(10), nullable=False, default="pickup")   # pickup | delivery | both
    images             = Column(ARRAY(Text), nullable=False, default=list, server_default="{}")
    safety_confirmed   = Column(Boolean, nullable=False, default=False)
    status             = Column(SAEnum("active", "sold_out", "expired", "closed", name="listing_status"),
                                nullable=False, default="active")
    created_at         = Column(DateTime, server_default=func.now())
    updated_at         = Column(DateTime, onupdate=func.now())

    donor    = relationship("User", back_populates="listings", foreign_keys=[donor_id])
    requests = relationship("FoodRequest", back_populates="listing")


class FoodRequest(Base):
    __tablename__ = "food_requests"

    id                 = Column(Integer, primary_key=True, index=True)
    recipient_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    listing_id         = Column(Integer, ForeignKey("food_listings.id"), nullable=False, index=True)
    quantity_requested = Column(Numeric(10, 2), nullable=False)
    message            = Column(Text, nullable=True)
    status             = Column(
        SAEnum("pending", "accepted", "declined", "cancelled", "collected", "completed", "no_show", "expired",
               name="request_status"),
        nullable=False, default="pending"
    )
    decline_reason     = Column(Text, nullable=True)
    responded_at       = Column(DateTime, nullable=True)
    collected_at       = Column(DateTime, nullable=True)
    completed_at       = Column(DateTime, nullable=True)
    created_at         = Column(DateTime, server_default=func.now())
    updated_at         = Column(DateTime, onupdate=func.now())

    recipient = relationship("User", back_populates="requests", foreign_keys=[recipient_id])
    listing   = relationship("FoodListing", back_populates="requests")
    feedback  = relationship("Feedback", back_populates="request")
    ratings   = relationship("Rating", back_populates="request", cascade="all, delete-orphan")


class Feedback(Base):
    """A message to the admin about the platform (any signed-in user), optionally tied to a completed request."""
    __tablename__ = "feedback"

    id              = Column(Integer, primary_key=True, index=True)
    request_id      = Column(Integer, ForeignKey("food_requests.id"), nullable=True, index=True)
    recipient_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)   # the author
    comment         = Column(Text, nullable=False)
    rating          = Column(Integer, nullable=True)
    image_path      = Column(String(500), nullable=True)
    admin_reply     = Column(Text, nullable=True)
    feedback_status = Column(String(10), nullable=False, server_default="open")
    created_at      = Column(DateTime, server_default=func.now())

    recipient = relationship("User", back_populates="feedback")
    request   = relationship("FoodRequest", back_populates="feedback")


class Rating(Base):
    """After a handover is completed, each side rates the other once."""
    __tablename__ = "ratings"
    __table_args__ = (UniqueConstraint("request_id", "rater_id", name="uq_rating_once"), Index("ix_ratings_ratee", "ratee_id"))

    id         = Column(Integer, primary_key=True)
    request_id = Column(Integer, ForeignKey("food_requests.id", ondelete="CASCADE"), nullable=False)
    rater_id   = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ratee_id   = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score      = Column(SmallInteger, nullable=False)
    comment    = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    request = relationship("FoodRequest", back_populates="ratings")
    rater   = relationship("User", foreign_keys=[rater_id])
    ratee   = relationship("User", foreign_keys=[ratee_id])


class Report(Base):
    """Anyone can report a listing, user or event; the admin reviews them."""
    __tablename__ = "reports"
    __table_args__ = (Index("ix_reports_status", "status"), Index("ix_reports_target", "target_type", "target_id"))

    id          = Column(Integer, primary_key=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    target_type = Column(String(20), nullable=False)   # listing | user | event | request
    target_id   = Column(Integer, nullable=False)
    reason      = Column(Text, nullable=False)
    status      = Column(String(20), nullable=False, server_default="open")   # open | actioned | dismissed
    admin_note  = Column(Text, nullable=True)
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, onupdate=func.now())

    reporter = relationship("User", foreign_keys=[reporter_id])


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user", "user_id", "is_read", "created_at"),)

    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind       = Column(String(30), nullable=False)   # new_listing | request_received | request_accepted | ...
    title      = Column(String(200), nullable=False)
    body       = Column(Text, nullable=False, default="")
    link       = Column(String(200), nullable=True)   # in-app route, e.g. /listings/12
    is_read    = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime, server_default=func.now())


class CommunityEvent(Base):
    """A food drive / volunteer session that an approved NGO publishes on the Events page."""
    __tablename__ = "community_events"

    id            = Column(Integer, primary_key=True, index=True)
    title         = Column(String(200), nullable=False)
    description   = Column(Text, nullable=False, default="")
    location      = Column(String(255), nullable=False)
    district      = Column(String(30), nullable=False, index=True)
    event_type    = Column(String(20), nullable=False, default="other")
    starts_at     = Column(DateTime, nullable=False, index=True)   # Sri Lanka local time
    ends_at       = Column(DateTime, nullable=True)
    capacity      = Column(Integer, nullable=True)                 # None = unlimited
    images        = Column(ARRAY(Text), nullable=False, default=list, server_default="{}")
    contact_name  = Column(String(120), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    contact_email = Column(String(255), nullable=True)
    status        = Column(String(12), nullable=False, default="published")   # published | cancelled
    owner_id      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at    = Column(DateTime, server_default=func.now())

    owner   = relationship("User", foreign_keys=[owner_id])
    signups = relationship("EventSignup", back_populates="event", cascade="all, delete-orphan")


class EventSignup(Base):
    __tablename__ = "event_signups"
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_event_signup"),)

    id         = Column(Integer, primary_key=True)
    event_id   = Column(Integer, ForeignKey("community_events.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    event = relationship("CommunityEvent", back_populates="signups")


class EventSubscriber(Base):
    """Email addresses that asked to hear about new events."""
    __tablename__ = "event_subscribers"

    id         = Column(Integer, primary_key=True)
    email      = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
