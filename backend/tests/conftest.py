"""
Shared pytest fixtures.

Prerequisites:
  - Backend .env must have a valid DATABASE_URL pointing to `sharing_excess`.
  - Tests create real rows prefixed "pytest_" and clean them up in teardown.
  - Email sending is mocked for all tests (no SMTP needed).

Run from backend/:
  pytest
"""
import os
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("RATE_LIMIT_ENABLED", "false")

from app.database import SessionLocal
from app.main import app
from app.models import Escalation, Feedback, FoodListing, FoodRequest, User
from app.utils.security import hash_password

_EMAIL_PREFIX = "pytest_"


def _unique_email(role: str) -> str:
    return f"{_EMAIL_PREFIX}{role}_{uuid.uuid4().hex[:8]}@example.com"


# ── Shared TestClient (mocks email globally) ──────────────────────────────────

@pytest.fixture(scope="session")
def client():
    # Each router does `from app.utils.email import send_email`, binding its
    # own local reference at import time — patching app.utils.email.send_email
    # alone would NOT intercept those calls. Patch every router's local name.
    with patch("app.routers.auth.send_email", return_value=True), \
         patch("app.routers.requests.send_email", return_value=True), \
         patch("app.routers.donations.send_email", return_value=True), \
         patch("app.routers.contact.send_email", return_value=True), \
         patch("app.routers.officer.send_email", return_value=True), \
         patch("app.routers.community_events.send_email", return_value=True):
        with TestClient(app) as c:
            yield c


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

    def _purge_events():
        from app.models import CommunityEvent, EventSubscriber

        db.query(CommunityEvent).filter(CommunityEvent.title.like("pytest_%")).delete(synchronize_session=False)
        db.query(EventSubscriber).filter(EventSubscriber.email.like(f"{_EMAIL_PREFIX}%")).delete(synchronize_session=False)
        db.commit()

    def _purge():
        _purge_events()
        users = db.query(User).filter(User.email.like(f"{_EMAIL_PREFIX}%")).all()
        ids = [u.id for u in users]
        if not ids:
            return
        # Delete the image files the test rows uploaded
        from app.utils.uploads import UPLOAD_DIR
        paths = [r[0] for r in db.query(FoodListing.image_path).filter(FoodListing.donor_id.in_(ids)).all()]
        paths += [r[0] for r in db.query(FoodRequest.image_path).filter(FoodRequest.recipient_id.in_(ids)).all()]
        paths += [r[0] for r in db.query(Feedback.image_path).filter(Feedback.recipient_id.in_(ids)).all()]
        for path in filter(None, paths):
            if path.startswith("/uploads/"):
                (UPLOAD_DIR / path.rsplit("/", 1)[-1]).unlink(missing_ok=True)
        db.query(Escalation).filter(Escalation.raised_by.in_(ids)).delete(synchronize_session=False)
        db.query(Feedback).filter(Feedback.recipient_id.in_(ids)).delete(synchronize_session=False)
        db.query(FoodRequest).filter(FoodRequest.recipient_id.in_(ids)).delete(synchronize_session=False)
        db.query(FoodListing).filter(FoodListing.donor_id.in_(ids)).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_(ids)).delete(synchronize_session=False)
        db.commit()

    _purge()
    yield
    _purge()


# ── Active user fixtures ──────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def donor(db):
    user = User(
        name="Pytest Donor",
        email=_unique_email("donor"),
        password=hash_password("testpass123"),
        role="donor",
        status="active",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="session")
def recipient(db):
    user = User(
        name="Pytest Recipient",
        email=_unique_email("recipient"),
        password=hash_password("testpass123"),
        role="recipient",
        status="active",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── Auth-token helpers ────────────────────────────────────────────────────────

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
