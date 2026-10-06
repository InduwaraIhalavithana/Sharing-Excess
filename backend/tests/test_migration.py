"""Migration 0006 (redesign v2) on a scratch database: old-style data goes in, the new shape comes out, and it
can be rolled back. Never touches the real database - it creates and drops its own."""
import os
import subprocess
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError

from app.config import settings

BACKEND = Path(__file__).resolve().parents[1]


def _alembic(url: str, *args: str) -> None:
    env = {**os.environ, "DATABASE_URL": url}
    out = subprocess.run([sys.executable, "-m", "alembic", *args], cwd=BACKEND, env=env, capture_output=True, text=True)
    assert out.returncode == 0, out.stdout + out.stderr


@pytest.fixture(scope="module")
def scratch():
    base = make_url(settings.database_url)
    name = f"se_migtest_{uuid.uuid4().hex[:8]}"
    admin_engine = create_engine(base.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as c:
        c.execute(text(f'CREATE DATABASE "{name}"'))
    url = base.set(database=name).render_as_string(hide_password=False)
    engine = create_engine(url)
    try:
        yield url, engine
    finally:
        engine.dispose()
        with admin_engine.connect() as c:
            c.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        admin_engine.dispose()


def _seed_old(engine) -> None:
    ok = (date.today() + timedelta(days=10)).isoformat()
    old = "2026-01-05"
    with engine.begin() as c:
        c.execute(text("""
          INSERT INTO users (id, name, email, password, role, status, location) VALUES
            (1, 'Donor One', 'd1@x.lk', 'x', 'donor', 'active', 'Pettah, Colombo'),
            (2, 'Recipient One', 'r1@x.lk', 'x', 'recipient', 'active', 'Bandarawela'),
            (3, 'Officer', 'o@x.lk', 'x', 'adminofficer', 'active', NULL),
            (4, 'Donor Two', 'd2@x.lk', 'x', 'donor', 'active', 'Somewhere unknown')"""))
        c.execute(text(f"""
          INSERT INTO food_listings (id, donor_id, food_name, quantity, expiry_date, location, status, verification_status) VALUES
            (10, 1, 'Fresh bread loaves', '40 loaves', '{ok}', 'Pettah, Colombo', 'available', 'approved'),
            (11, 1, 'Vegetable curry', '30 meals', '{ok}', 'Negombo', 'available', 'pending_review'),
            (12, 4, 'Rejected stew', '5 kg', '{ok}', 'Kandy', 'available', 'rejected'),
            (13, 1, 'Old rice', '10 kg', '{old}', 'Colombo', 'available', 'approved'),
            (14, 4, 'Mystery box', 'a box', '{ok}', 'Nowhere', 'accepted', 'approved'),
            (15, 1, 'Partly taken', '10 kg', '{ok}', 'Galle', 'accepted', 'approved')"""))
        c.execute(text("""
          INSERT INTO food_requests (id, recipient_id, food_name, quantity, status, listing_id) VALUES
            (20, 2, 'Fresh bread loaves', '10 loaves', 'pending', 10),
            (21, 2, 'Partly taken', '2 kg', 'delivered', 15),
            (22, 2, 'Partly taken', '3 kg', 'accepted', 15),
            (23, 2, 'Open need: rice', '20 kg', 'pending', NULL),
            (24, 2, 'Open need: milk', '5 l', 'delivered', NULL),
            (25, 2, 'Rejected stew', '5 kg', 'declined', 12)"""))
        c.execute(text("INSERT INTO feedback (id, request_id, recipient_id, comment) VALUES "
                       "(30, 24, 2, 'Thanks for the milk'), (31, 21, 2, 'Good')"))
        c.execute(text("INSERT INTO escalations (id, raised_by, target_type, target_id, reason, status) VALUES "
                       "(40, 3, 'listing', 12, 'looks off', 'open')"))
        c.execute(text("INSERT INTO money_donations (id, name, email, amount, source) VALUES "
                       "(50, 'Kind Person', 'k@x.lk', 1500.00, 'manual')"))
        c.execute(text("SELECT setval(pg_get_serial_sequence('food_requests','id'), 100)"))


def _rows(engine, sql: str):
    with engine.connect() as c:
        return c.execute(text(sql)).mappings().all()


def test_upgrade_converts_the_data_and_downgrade_restores_it(scratch):
    url, engine = scratch
    _alembic(url, "upgrade", "0005")
    _seed_old(engine)

    _alembic(url, "upgrade", "head")

    # users: the officer is the single admin; districts inferred from free text where possible
    users = {r["id"]: r for r in _rows(engine, "SELECT id, role::text AS role, district, notify_email, ngo_status FROM users")}
    assert users[3]["role"] == "admin" and users[1]["role"] == "donor"
    assert users[1]["district"] == "Colombo" and users[2]["district"] == "Badulla" and users[4]["district"] is None
    assert users[1]["notify_email"] is True and users[1]["ngo_status"] is None

    L = {r["id"]: r for r in _rows(engine, """SELECT id, status::text AS status, quantity_total, quantity_available, unit,
                                              district, category, expires_at, images FROM food_listings""")}
    assert (float(L[10]["quantity_total"]), L[10]["unit"], L[10]["category"]) == (40.0, "loaves", "bakery")
    assert L[10]["status"] == "active" and float(L[10]["quantity_available"]) == 30.0   # a pending request holds 10
    assert L[11]["status"] == "active" and L[11]["district"] == "Gampaha"               # pending_review goes live; Negombo -> Gampaha
    assert L[12]["status"] == "closed"                                                  # rejected stays out
    assert L[13]["status"] == "expired"
    assert L[14]["district"] == "Colombo" and float(L[14]["quantity_total"]) == 1.0    # nothing to parse, nothing to infer: safe defaults
    assert L[15]["district"] == "Galle"
    assert float(L[15]["quantity_total"]) == 10.0 and float(L[15]["quantity_available"]) == 5.0   # 2 delivered + 3 accepted
    assert L[10]["images"] == []

    R = {r["id"]: r for r in _rows(engine, "SELECT id, listing_id, status::text AS status, quantity_requested FROM food_requests")}
    assert set(R) == {20, 21, 22, 25}                      # the open needs board (23, 24) is gone
    assert R[21]["status"] == "completed" and float(R[21]["quantity_requested"]) == 2.0
    assert R[22]["status"] == "accepted" and R[20]["status"] == "pending" and R[25]["status"] == "declined"

    assert [r["request_id"] for r in _rows(engine, "SELECT request_id FROM feedback WHERE id = 30")] == [None]   # kept, unlinked
    assert _rows(engine, "SELECT request_id FROM feedback WHERE id = 31")[0]["request_id"] == 21
    assert _rows(engine, "SELECT reason, status FROM reports")[0]["reason"] == "looks off"
    tables = {r["t"] for r in _rows(engine, "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public'")}
    assert {"notifications", "ratings", "reports", "legacy_v1_users", "legacy_v1_food_requests", "legacy_v1_money_donations"} <= tables
    assert not ({"money_donations", "escalations"} & tables)

    # the database itself refuses an impossible stock level
    with pytest.raises(IntegrityError) as exc:
        with engine.begin() as c:
            c.execute(text("UPDATE food_listings SET quantity_available = quantity_total + 1 WHERE id = 10"))
    assert "ck_listing_stock" in str(exc.value)
    with pytest.raises(IntegrityError):
        with engine.begin() as c:
            c.execute(text("UPDATE food_listings SET quantity_available = -1 WHERE id = 10"))

    # ── rollback ──
    _alembic(url, "downgrade", "0005")
    old_users = {r["id"]: r["role"] for r in _rows(engine, "SELECT id, role::text AS role FROM users")}
    assert old_users[3] == "adminofficer"
    old_l = {r["id"]: r for r in _rows(engine, "SELECT id, quantity, expiry_date, location, verification_status, status::text AS status FROM food_listings")}
    assert old_l[10]["quantity"] == "40 loaves" and old_l[12]["verification_status"] == "rejected"
    assert old_l[15]["status"] == "accepted" and old_l[11]["verification_status"] == "pending_review"
    old_r = {r["id"]: r for r in _rows(engine, "SELECT id, food_name, quantity, status::text AS status, listing_id FROM food_requests")}
    assert set(old_r) == {20, 21, 22, 23, 24, 25}          # the open-board rows are back
    assert old_r[24]["food_name"] == "Open need: milk" and old_r[24]["listing_id"] is None
    assert old_r[21]["status"] == "delivered" and old_r[21]["quantity"] == "2 kg"
    assert float(_rows(engine, "SELECT amount FROM money_donations")[0]["amount"]) == 1500.0
    assert _rows(engine, "SELECT reason FROM escalations")[0]["reason"] == "looks off"
    assert not ({"reports", "notifications", "ratings"} & {r["t"] for r in _rows(
        engine, "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public'")})

    # and forward again works on the rolled-back data
    _alembic(url, "upgrade", "head")
    assert _rows(engine, "SELECT count(*) AS n FROM food_listings")[0]["n"] == 6
