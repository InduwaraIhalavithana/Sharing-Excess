"""Integration tests for /api/requests, calendar privacy and public stats."""
import uuid


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _request(db, recipient_id, name="Vegetables", status="pending", listing_id=None):
    from app.models import FoodRequest

    req = FoodRequest(recipient_id=recipient_id, food_name=name, quantity="3 kg",
                      status=status, location="Colombo", listing_id=listing_id)
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def _other_donor(db):
    from app.models import User
    from app.utils.security import hash_password

    u = User(name="Other Donor", email=f"pytest_od_{uuid.uuid4().hex[:6]}@example.com",
             password=hash_password("testpass123"), role="donor", status="active")
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


class TestGetRequests:
    def test_requires_login(self, client):
        assert client.get("/api/requests?donor_view=true").status_code == 401

    def test_donor_can_browse_open_requests(self, client, donor_token):
        res = client.get("/api/requests?donor_view=true", headers=bearer(donor_token))
        assert res.status_code == 200
        assert isinstance(res.json()["requests"], list)

    def test_recipient_cannot_browse_open_board(self, client, recipient_token):
        res = client.get("/api/requests?donor_view=true", headers=bearer(recipient_token))
        assert res.status_code == 403

    def test_recipient_sees_own_requests(self, client, recipient, recipient_token):
        res = client.get(f"/api/requests?recipient_id={recipient.id}", headers=bearer(recipient_token))
        assert res.status_code == 200
        for req in res.json()["requests"]:
            assert req["recipient_id"] == recipient.id

    def test_cannot_read_someone_elses_requests(self, client, recipient, donor_token):
        res = client.get(f"/api/requests?recipient_id={recipient.id}", headers=bearer(donor_token))
        assert res.status_code == 403


class TestCreateRequest:
    def test_create_request_success(self, client, recipient, recipient_token, db):
        from app.models import FoodRequest

        res = client.post("/api/requests", headers=bearer(recipient_token), data={
            "food_name": "Lentils", "quantity": "2 kg", "needed_by": "2026-12-31", "location": "Galle",
        })
        assert res.status_code == 200
        req = db.query(FoodRequest).filter(FoodRequest.id == res.json()["request"]["id"]).first()
        assert req.food_name == "Lentils"
        assert req.recipient_id == recipient.id
        assert req.status == "pending"

    def test_recipient_id_in_body_is_ignored(self, client, recipient, recipient_token, donor):
        res = client.post("/api/requests", headers=bearer(recipient_token), data={
            "recipient_id": str(donor.id), "food_name": "Spoof", "quantity": "1",
        })
        assert res.status_code == 200
        assert res.json()["request"]["recipient_id"] == recipient.id

    def test_requires_login(self, client):
        assert client.post("/api/requests", data={"food_name": "x", "quantity": "1"}).status_code == 401

    def test_donor_cannot_create_request(self, client, donor_token):
        res = client.post("/api/requests", headers=bearer(donor_token), data={"food_name": "x", "quantity": "1"})
        assert res.status_code == 403

    def test_missing_food_name(self, client, recipient_token):
        res = client.post("/api/requests", headers=bearer(recipient_token), data={"quantity": "1 kg"})
        assert res.status_code == 422


class TestDeleteRequest:
    def test_delete_own_request(self, client, recipient, recipient_token, db):
        from app.models import FoodRequest

        req = _request(db, recipient.id, "To Delete")
        res = client.delete(f"/api/requests/{req.id}", headers=bearer(recipient_token))
        assert res.status_code == 200
        assert db.query(FoodRequest).filter(FoodRequest.id == req.id).first() is None

    def test_delete_requires_login(self, client, recipient, db):
        req = _request(db, recipient.id)
        assert client.delete(f"/api/requests/{req.id}").status_code == 401

    def test_cannot_delete_someone_elses_request(self, client, recipient, donor_token, db):
        req = _request(db, recipient.id)
        assert client.delete(f"/api/requests/{req.id}", headers=bearer(donor_token)).status_code == 403

    def test_delete_nonexistent_request(self, client, recipient_token):
        assert client.delete("/api/requests/999999999", headers=bearer(recipient_token)).status_code == 404


class TestRespondToRequest:
    def test_accept_request(self, client, donor, donor_token, recipient, db):
        req = _request(db, recipient.id)
        res = client.put(f"/api/requests/{req.id}/respond", headers=bearer(donor_token),
                         json={"request_id": req.id, "status": "accepted"})
        assert res.status_code == 200
        db.refresh(req)
        assert req.status == "accepted"
        assert req.accepted_by == donor.name

    def test_spoofed_user_name_is_ignored(self, client, donor, donor_token, recipient, db):
        req = _request(db, recipient.id)
        client.put(f"/api/requests/{req.id}/respond", headers=bearer(donor_token),
                   json={"request_id": req.id, "status": "accepted", "user_id": 1, "user_name": "Somebody Else"})
        db.refresh(req)
        assert req.accepted_by == donor.name

    def test_decline_request(self, client, donor_token, recipient, db):
        req = _request(db, recipient.id, "Fruits")
        res = client.put(f"/api/requests/{req.id}/respond", headers=bearer(donor_token),
                         json={"request_id": req.id, "status": "declined"})
        assert res.status_code == 200
        db.refresh(req)
        assert req.status == "declined"

    def test_respond_requires_login(self, client, recipient, db):
        req = _request(db, recipient.id)
        res = client.put(f"/api/requests/{req.id}/respond", json={"request_id": req.id, "status": "accepted"})
        assert res.status_code == 401

    def test_recipient_cannot_respond(self, client, recipient, recipient_token, db):
        req = _request(db, recipient.id)
        res = client.put(f"/api/requests/{req.id}/respond", headers=bearer(recipient_token),
                         json={"request_id": req.id, "status": "accepted"})
        assert res.status_code == 403

    def test_other_donor_cannot_answer_a_listing_request(self, client, donor, recipient, db):
        from app.models import FoodListing

        listing = FoodListing(donor_id=donor.id, food_name="Owned", quantity="1", status="available",
                              verification_status="approved")
        db.add(listing)
        db.commit()
        db.refresh(listing)
        req = _request(db, recipient.id, "For Owned", listing_id=listing.id)
        other = _other_donor(db)
        login = client.post("/api/auth/login", json={"email": other.email, "password": "testpass123"})
        res = client.put(f"/api/requests/{req.id}/respond", headers=bearer(login.json()["token"]),
                         json={"request_id": req.id, "status": "accepted"})
        assert res.status_code == 403

    def test_cannot_respond_twice(self, client, donor_token, recipient, db):
        req = _request(db, recipient.id, status="accepted")
        res = client.put(f"/api/requests/{req.id}/respond", headers=bearer(donor_token),
                         json={"request_id": req.id, "status": "declined"})
        assert res.status_code == 400


class TestDeliveryStatus:
    def test_invalid_status_rejected(self, client, donor_token, recipient, db):
        req = _request(db, recipient.id, status="accepted")
        res = client.put(f"/api/requests/{req.id}/status", headers=bearer(donor_token),
                         json={"request_id": req.id, "status": "banana"})
        assert res.status_code == 400

    def test_requires_login(self, client, recipient, db):
        req = _request(db, recipient.id, status="accepted")
        res = client.put(f"/api/requests/{req.id}/status", json={"request_id": req.id, "status": "delivered"})
        assert res.status_code == 401

    def test_recipient_can_mark_picked_up_but_not_delivered(self, client, recipient_token, recipient, db):
        req = _request(db, recipient.id, status="accepted")
        bad = client.put(f"/api/requests/{req.id}/status", headers=bearer(recipient_token),
                         json={"request_id": req.id, "status": "delivered"})
        assert bad.status_code == 403
        ok = client.put(f"/api/requests/{req.id}/status", headers=bearer(recipient_token),
                        json={"request_id": req.id, "status": "picked_up"})
        assert ok.status_code == 200

    def test_stranger_cannot_change_status(self, client, recipient, db):
        req = _request(db, recipient.id, status="accepted")
        other = _other_donor(db)
        token = client.post("/api/auth/login", json={"email": other.email, "password": "testpass123"}).json()["token"]
        res = client.put(f"/api/requests/{req.id}/status", headers=bearer(token),
                         json={"request_id": req.id, "status": "delivered"})
        assert res.status_code == 403


class TestPrivacy:
    def test_calendar_requires_login(self, client):
        assert client.get("/api/calendar/events").status_code == 401

    def test_calendar_hides_unrelated_contact_details(self, client, recipient, donor_token, recipient_token, db):
        req = _request(db, recipient.id, "Calendar Item")
        # A donor with no link to this request must not see the recipient's email/phone
        events = client.get("/api/calendar/events", headers=bearer(donor_token)).json()["events"]
        mine = [e for e in events if e["id"] == f"req_{req.id}"][0]
        assert mine["recipient"]["email"] is None
        # ...but the recipient sees their own details
        events = client.get("/api/calendar/events", headers=bearer(recipient_token)).json()["events"]
        mine = [e for e in events if e["id"] == f"req_{req.id}"][0]
        assert mine["recipient"]["email"] == recipient.email

    def test_public_stats_are_counts_only(self, client):
        res = client.get("/api/public/stats")
        assert res.status_code == 200
        data = res.json()
        assert set(data) == {"success", "listings_available", "requests_open",
                             "meals_delivered", "donors", "recipients"}
        assert all(isinstance(v, (int, bool)) for v in data.values())


class TestPayhereInitiate:
    def test_payhere_initiate_returns_hash(self, client):
        res = client.post("/api/donations/payhere/initiate", json={
            "name": "Test Donor", "email": "pytest_payhere@example.com", "amount": 4000.0,
        })
        assert res.status_code == 200
        params = res.json()["params"]
        assert len(params["hash"]) == 32  # MD5 hex length
        assert params["currency"] == "LKR"
        assert params["amount"] == "4000.00"
        assert params["order_id"].startswith("SE-")


class TestDonorBoardScope:
    def test_donor_board_excludes_other_donors_listing_requests(self, client, donor, recipient, db):
        from app.models import FoodListing

        other = _other_donor(db)
        listing = FoodListing(donor_id=other.id, food_name="Theirs", quantity="1", status="available",
                              verification_status="approved")
        db.add(listing)
        db.commit()
        db.refresh(listing)
        hidden = _request(db, recipient.id, "Hidden From Me", listing_id=listing.id)
        open_req = _request(db, recipient.id, "Open To All")

        token = client.post("/api/auth/login", json={"email": donor.email, "password": "testpass123"}).json()["token"]
        ids = {r["id"] for r in client.get("/api/requests?donor_view=true", headers=bearer(token)).json()["requests"]}
        assert open_req.id in ids
        assert hidden.id not in ids
