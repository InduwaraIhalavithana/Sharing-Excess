"""The single 'adminofficer' staff role: full officer + admin powers, nobody else gets them."""
import uuid

import pytest


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def staff(db):
    from app.models import User
    from app.utils.security import hash_password

    u = User(name="Pytest Staff", email=f"pytest_staff_{uuid.uuid4().hex[:8]}@example.com",
             password=hash_password("testpass123"), role="adminofficer", status="active")
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture(scope="module")
def staff_token(client, staff):
    res = client.post("/api/auth/officer-login", json={"email": staff.email, "password": "testpass123"})
    assert res.status_code == 200, res.text
    return res.json()["token"]


def _pending_listing(db, donor_id):
    from app.models import FoodListing

    l = FoodListing(donor_id=donor_id, food_name="Needs Review", quantity="1", status="available",
                    verification_status="pending_review")
    db.add(l)
    db.commit()
    db.refresh(l)
    return l


class TestStaffLogin:
    def test_staff_login_reports_the_merged_role(self, client, staff):
        res = client.post("/api/auth/officer-login", json={"email": staff.email, "password": "testpass123"})
        assert res.json()["officer"]["role"] == "adminofficer"

    def test_regular_users_cannot_use_the_staff_login(self, client, donor):
        res = client.post("/api/auth/officer-login", json={"email": donor.email, "password": "testpass123"})
        assert res.status_code == 401

    def test_cannot_sign_up_as_staff(self, client):
        res = client.post("/api/auth/signup", json={
            "name": "Sneaky", "email": f"pytest_sneaky_{uuid.uuid4().hex[:6]}@example.com",
            "password": "testpass123", "role": "adminofficer",
        })
        assert res.status_code == 200
        assert res.json()["role"] == "recipient"


class TestStaffPowers:
    """Everything that used to be admin-only is available to the one staff role."""

    def test_staff_can_verify_listings(self, client, staff_token, donor, db):
        listing = _pending_listing(db, donor.id)
        res = client.patch(f"/api/officer/listings/{listing.id}/verify", headers=bearer(staff_token),
                           json={"action": "approve"})
        assert res.status_code == 200
        db.refresh(listing)
        assert listing.verification_status == "approved"

    def test_staff_can_list_users_and_money_donations(self, client, staff_token):
        assert client.get("/api/officer/users", headers=bearer(staff_token)).status_code == 200
        assert client.get("/api/officer/donations/money", headers=bearer(staff_token)).status_code == 200

    def test_stats_include_financial_totals(self, client, staff_token):
        data = client.get("/api/officer/stats", headers=bearer(staff_token)).json()
        assert "total_money_donations" in data

    def test_staff_accounts_are_protected(self, client, staff_token, staff):
        assert client.patch(f"/api/officer/users/{staff.id}/suspend", headers=bearer(staff_token)).status_code == 403
        assert client.delete(f"/api/officer/users/{staff.id}", headers=bearer(staff_token)).status_code == 403

    def test_staff_cannot_promote_a_user_to_staff(self, client, staff_token, donor):
        res = client.put(f"/api/officer/users/{donor.id}", headers=bearer(staff_token), json={"role": "adminofficer"})
        assert res.status_code == 400

    def test_any_staff_can_see_and_action_flags(self, client, staff_token, donor):
        flag = client.post("/api/officer/escalations", headers=bearer(staff_token),
                           json={"target_type": "user", "target_id": donor.id, "reason": "pytest flag"})
        assert flag.status_code == 200
        listed = client.get("/api/officer/escalations", headers=bearer(staff_token)).json()["escalations"]
        mine = [e for e in listed if e["reason"] == "pytest flag"][0]
        done = client.patch(f"/api/officer/escalations/{mine['id']}", headers=bearer(staff_token),
                            json={"status": "actioned"})
        assert done.status_code == 200


class TestNobodyElseGetsStaffPowers:
    @pytest.mark.parametrize("path", [
        "/api/officer/users", "/api/officer/requests", "/api/officer/listings",
        "/api/officer/donations/money", "/api/officer/stats", "/api/officer/escalations",
    ])
    def test_donor_and_recipient_are_refused(self, client, donor_token, recipient_token, path):
        assert client.get(path, headers=bearer(donor_token)).status_code == 403
        assert client.get(path, headers=bearer(recipient_token)).status_code == 403
        assert client.get(path).status_code == 401

    def test_staff_can_delete_any_listing_and_request(self, client, staff_token, donor, recipient, db):
        from app.models import FoodListing, FoodRequest

        listing = _pending_listing(db, donor.id)
        assert client.delete(f"/api/listings/{listing.id}", headers=bearer(staff_token)).status_code == 200
        assert db.query(FoodListing).filter(FoodListing.id == listing.id).first() is None

        req = FoodRequest(recipient_id=recipient.id, food_name="x", quantity="1", status="pending")
        db.add(req)
        db.commit()
        db.refresh(req)
        assert client.delete(f"/api/requests/{req.id}", headers=bearer(staff_token)).status_code == 200
