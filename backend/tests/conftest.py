"""Shared pytest fixtures.

Prerequisites:
  - Backend .env must have a valid DATABASE_URL pointing to `sharing_excess`.
  - Tests create real rows prefixed "pytest_" and clean them up in teardown.
  - Email sending is replaced by a recorder for all tests (no SMTP needed): see the `outbox` fixture.

Run from backend/:
  pytest
"""
import io
import os
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image

os.environ.setdefault("RATE_LIMIT_ENABLED", "false")

from app.database import SessionLocal
from app.main import app
from app.models import (
    CommunityEvent,
    EventSubscriber,
    Notification,
    Report,
    User,
)
from app.services.accounts import purge_user
from app.utils.jwt import create_access_token
from app.utils.security import hash_password
from app.utils.timeutil import now_colombo

_EMAIL_PREFIX = "pytest_"
_SENT: list[dict] = []


def _record_email(to, subject, html):
    _SENT.append({"to": to, "subject": subject, "html": html})
    return True


def _unique_email(role: str) -> str:
    return f"{_EMAIL_PREFIX}{role}_{uuid.uuid4().hex[:8]}@example.com"


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Shared TestClient (records email globally) ────────────────────────────────

@pytest.fixture(scope="session")
def client():
    # Each module does `from app.utils.email import send_email`, binding its own local reference at import
    # time - patching app.utils.email.send_email alone would NOT intercept those calls.
    with patch("app.routers.auth.send_email", _record_email), \
         patch("app.routers.contact.send_email", _record_email), \
         patch("app.services.notifications.send_email", _record_email):
        with TestClient(app) as c:
            yield c


@pytest.fixture()
def outbox():
    """Every email the app tried to send during this test, as dicts with to / subject / html."""
    _SENT.clear()
    return _SENT


# ── Shared DB session ─────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def db():
    session = SessionLocal()
    yield session
    session.close()


# ── Cleanup all pytest_ data before and after the full run ───────────────────

@pytest.fixture(scope="session", autouse=True)
def _cleanup_test_rows(db):
    """Remove stale pytest_ rows at start and end of every test run."""

    def _purge():
        db.rollback()
        from app.utils.uploads import delete_upload
        for event in db.query(CommunityEvent).filter(CommunityEvent.title.like("pytest_%")).all():
            for url in event.images or []:
                delete_upload(url)     # event photos would otherwise be left behind in uploads/
            db.delete(event)
        db.query(EventSubscriber).filter(EventSubscriber.email.like(f"{_EMAIL_PREFIX}%")).delete(synchronize_session=False)
        db.query(Report).filter(Report.reason.like("pytest_%")).delete(synchronize_session=False)
        # announcements of test listings / events also reach real users' bells: remove those rows
        db.query(Notification).filter(Notification.title.like(r"%pytest\_%")).delete(synchronize_session=False)
        db.commit()
        for u in db.query(User).filter(User.email.like(f"{_EMAIL_PREFIX}%")).all():
            purge_user(db, u)

    _purge()
    yield
    _purge()


# ── Users ─────────────────────────────────────────────────────────────────────

class Account:
    """A throw-away active user plus a ready Authorization header."""

    def __init__(self, user: User):
        self.user = user
        self.id = user.id
        self.email = user.email
        self.token = create_access_token(user.id, user.role)
        self.h = bearer(self.token)


@pytest.fixture(scope="session")
def make_user(db):
    def _make(role="recipient", district="Colombo", **kw) -> Account:
        fields = dict(name=f"Pytest {role.title()}", email=_unique_email(role), password=hash_password("testpass123"),
                      role=role, status="active", district=district)
        if role == "ngo":
            fields.setdefault("org_name", "Pytest Org")
            fields.setdefault("ngo_status", "approved")
        fields.update(kw)
        user = User(**fields)
        db.add(user)
        db.commit()
        db.refresh(user)
        return Account(user)
    return _make


# The classic pair most tests use (both in Colombo).
@pytest.fixture(scope="session")
def donor(make_user):
    return make_user("donor", phone_number="0771111111").user


@pytest.fixture(scope="session")
def recipient(make_user):
    return make_user("recipient").user


@pytest.fixture(scope="session")
def donor_token(client, donor):
    res = client.post("/api/auth/login", json={"email": donor.email, "password": "testpass123"})
    assert res.status_code == 200, res.text
    return res.json()["token"]


@pytest.fixture(scope="session")
def recipient_token(client, recipient):
    res = client.post("/api/auth/login", json={"email": recipient.email, "password": "testpass123"})
    assert res.status_code == 200, res.text
    return res.json()["token"]


@pytest.fixture(scope="session")
def admin(make_user):
    return make_user("admin")


# ── Listing helpers ───────────────────────────────────────────────────────────

def png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (30, 160, 60)).save(buf, format="PNG")
    return buf.getvalue()


def in_hours(h: float) -> str:
    return (now_colombo() + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M")


def listing_form(**over) -> dict:
    data = {"food_name": "pytest_ rice and curry", "category": "cooked_meals", "quantity_total": "10", "unit": "portions",
            "district": "Colombo", "area": "Pettah", "pickup_address": "12 Secret Lane, Pettah",
            "expires_at": in_hours(24), "safety_confirmed": "true", "description": "Fresh today", "fulfilment": "pickup"}
    data.update({k: v for k, v in over.items() if v is not None})
    return {k: v for k, v in data.items()}


@pytest.fixture(scope="session")
def post_listing(client):
    """post_listing(account, n_images=1, **form_overrides) -> the created listing dict (asserts success)."""
    def _post(account: Account, n_images: int = 1, expect: int = 200, **over):
        files = [("images", (f"p{i}.png", png_bytes(), "image/png")) for i in range(n_images)]
        res = client.post("/api/listings", headers=account.h, data=listing_form(**over), files=files or None)
        assert res.status_code == expect, res.text
        return res.json()["listing"] if expect == 200 else res
    return _post


@pytest.fixture(scope="session")
def request_food(client):
    """request_food(account, listing_id, qty) -> response."""
    def _req(account: Account, listing_id: int, qty, message: str = ""):
        return client.post("/api/requests", headers=account.h,
                           json={"listing_id": listing_id, "quantity_requested": qty, "message": message})
    return _req


def listing_row(db, listing_id: int):
    from app.models import FoodListing
    db.expire_all()
    return db.get(FoodListing, listing_id)


def later(hours: float = 0) -> datetime:
    return now_colombo() + timedelta(hours=hours)
