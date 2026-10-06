"""Money donations: the PayHere callback is verified and idempotent; manual entry is staff-only."""
import uuid
from unittest.mock import patch

import pytest

from app.config import settings
from app.routers.donations import _notify_signature, _payhere_hash


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def staff_token(client, db):
    from app.models import User
    from app.utils.security import hash_password

    u = User(name="Pytest Money Staff", email=f"pytest_money_{uuid.uuid4().hex[:6]}@example.com",
             password=hash_password("testpass123"), role="adminofficer", status="active")
    db.add(u)
    db.commit()
    return client.post("/api/auth/officer-login", json={"email": u.email, "password": "testpass123"}).json()["token"]


def notification(**over) -> dict:
    """A PayHere server notification, signed the way PayHere signs it."""
    f = {
        "merchant_id": settings.payhere_merchant_id,
        "order_id": f"SE-PYTEST{uuid.uuid4().hex[:8].upper()}",
        "payhere_amount": "1500.00",
        "payhere_currency": "LKR",
        "status_code": "2",
        "custom_1": "Nimali Perera",
        "custom_2": f"pytest_pay_{uuid.uuid4().hex[:6]}@example.com",
        "card_no": "************1234",
    }
    f.update(over)
    f["md5sig"] = over.get("md5sig") or _notify_signature(
        f["merchant_id"], f["order_id"], f["payhere_amount"], f["payhere_currency"], f["status_code"],
        settings.payhere_merchant_secret)
    return f


def donations(db, email):
    from app.models import MoneyDonation

    db.expire_all()
    return db.query(MoneyDonation).filter(MoneyDonation.email == email).all()


class TestPayHereNotification:
    def test_a_signed_successful_payment_is_recorded(self, client, db):
        n = notification()
        with patch("app.routers.donations.send_email", return_value=True) as sent:
            res = client.post("/api/donations/payhere/notify", data=n)
        assert res.status_code == 200 and res.json() == {"status": "ok"}
        rows = donations(db, n["custom_2"])
        assert len(rows) == 1
        assert (rows[0].name, float(rows[0].amount), rows[0].card_last4, rows[0].source) == ("Nimali Perera", 1500.0, "1234", "payhere")
        assert sent.call_args.args[0] == n["custom_2"]  # the donor gets a thank-you

    def test_a_retried_notification_is_not_recorded_twice(self, client, db):
        n = notification()
        assert client.post("/api/donations/payhere/notify", data=n).json() == {"status": "ok"}
        assert client.post("/api/donations/payhere/notify", data=n).json() == {"status": "duplicate"}
        assert len(donations(db, n["custom_2"])) == 1

    def test_a_forged_signature_is_rejected_and_records_nothing(self, client, db):
        n = notification(md5sig="0" * 32)
        assert client.post("/api/donations/payhere/notify", data=n).status_code == 400
        assert donations(db, n["custom_2"]) == []

    def test_a_tampered_amount_is_rejected(self, client, db):
        n = notification()
        n["payhere_amount"] = "999999.00"  # changed after signing
        assert client.post("/api/donations/payhere/notify", data=n).status_code == 400
        assert donations(db, n["custom_2"]) == []

    def test_a_payment_for_another_merchant_is_rejected(self, client):
        n = notification(merchant_id="999")
        assert client.post("/api/donations/payhere/notify", data=n).status_code == 400

    @pytest.mark.parametrize("status", ["0", "-1", "-2", "-3"])
    def test_unfinished_or_failed_payments_record_nothing(self, client, db, status):
        n = notification(status_code=status)
        res = client.post("/api/donations/payhere/notify", data=n)
        assert res.status_code == 200 and res.json() == {"status": "ignored"}
        assert donations(db, n["custom_2"]) == []

    def test_the_browser_returning_from_checkout_records_nothing(self, client, db):
        # the success URL is just a page; only the verified notification above counts
        before = len(donations(db, "pytest_nobody@example.com"))
        client.get("/api/public/stats")
        assert len(donations(db, "pytest_nobody@example.com")) == before


class TestInitiate:
    def test_checkout_parameters_carry_the_payer_and_a_valid_hash(self, client):
        res = client.post("/api/donations/payhere/initiate", json={
            "name": "Nimali Perera", "email": "pytest_init@example.com", "amount": 2500})
        p = res.json()["params"]
        assert p["custom_1"] == "Nimali Perera" and p["custom_2"] == "pytest_init@example.com"
        assert p["hash"] == _payhere_hash(p["merchant_id"], p["order_id"], p["amount"], p["currency"], settings.payhere_merchant_secret)
        assert p["notify_url"].endswith("/api/donations/payhere/notify")


class TestOfflineDonations:
    body = {"name": "Walk-in donor", "email": "pytest_offline@example.com", "amount": 5000}

    def test_requires_staff(self, client, donor_token, recipient_token):
        assert client.post("/api/donations/money", json=self.body).status_code == 401
        assert client.post("/api/donations/money", json=self.body, headers=bearer(donor_token)).status_code == 403
        assert client.post("/api/donations/money", json=self.body, headers=bearer(recipient_token)).status_code == 403

    def test_staff_can_record_one_without_a_card(self, client, db, staff_token):
        res = client.post("/api/donations/money", json=self.body, headers=bearer(staff_token))
        assert res.status_code == 200
        row = donations(db, self.body["email"])[0]
        assert row.source == "manual" and row.card_last4 is None

    def test_a_bad_amount_is_rejected(self, client, staff_token):
        res = client.post("/api/donations/money", json={**self.body, "amount": -5}, headers=bearer(staff_token))
        assert res.status_code == 422
