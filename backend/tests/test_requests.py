"""Integration tests for /api/requests endpoints."""
import pytest


class TestGetRequests:
    def test_get_requests_as_donor(self, client):
        res = client.get("/api/requests?donor_view=true")
        assert res.status_code == 200
        data = res.json()
        assert "requests" in data
        assert isinstance(data["requests"], list)

    def test_get_requests_by_recipient(self, client, recipient):
        res = client.get(f"/api/requests?recipient_id={recipient.id}")
        assert res.status_code == 200
        data = res.json()
        assert "requests" in data
        for req in data["requests"]:
            assert req["recipient_id"] == recipient.id


class TestCreateRequest:
    def test_create_request_success(self, client, recipient, db):
        from app.models import FoodRequest

        res = client.post("/api/requests", data={
            "recipient_id": str(recipient.id),
            "food_name": "Lentils",
            "quantity": "2 kg",
            "needed_by": "2026-12-31",
            "location": "Galle",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "request" in data and "id" in data["request"]

        # Verify stored
        req = db.query(FoodRequest).filter(FoodRequest.id == data["request"]["id"]).first()
        assert req is not None
        assert req.food_name == "Lentils"
        assert req.recipient_id == recipient.id
        assert req.status == "pending"

    def test_create_request_missing_food_name(self, client, recipient):
        res = client.post("/api/requests", data={
            "recipient_id": str(recipient.id),
            "quantity": "1 kg",
            "needed_by": "2026-12-31",
            "location": "Colombo",
        })
        assert res.status_code == 422

    def test_create_request_invalid_recipient(self, client):
        res = client.post("/api/requests", data={
            "recipient_id": "999999",
            "food_name": "Bread",
            "quantity": "1 loaf",
            "needed_by": "2026-12-31",
            "location": "Colombo",
        })
        assert res.status_code in (400, 404, 422)


class TestDeleteRequest:
    def test_delete_pending_request(self, client, recipient, db):
        from app.models import FoodRequest

        req = FoodRequest(
            recipient_id=recipient.id,
            food_name="To Delete",
            quantity="1 unit",
            status="pending",
            location="Colombo",
        )
        db.add(req)
        db.commit()
        db.refresh(req)

        res = client.delete(f"/api/requests/{req.id}")
        assert res.status_code == 200
        assert res.json()["success"] is True

        gone = db.query(FoodRequest).filter(FoodRequest.id == req.id).first()
        assert gone is None

    def test_delete_nonexistent_request(self, client):
        res = client.delete("/api/requests/999999999")
        assert res.status_code == 404


class TestRespondToRequest:
    def test_accept_request(self, client, donor, recipient, db):
        from app.models import FoodRequest

        req = FoodRequest(
            recipient_id=recipient.id,
            food_name="Vegetables",
            quantity="3 kg",
            status="pending",
            location="Colombo",
        )
        db.add(req)
        db.commit()
        db.refresh(req)

        res = client.put(f"/api/requests/{req.id}/respond", json={
            "request_id": req.id,
            "status": "accepted",
            "user_id": donor.id,
            "user_name": donor.name,
        })
        assert res.status_code == 200
        assert res.json()["success"] is True

        db.refresh(req)
        assert req.status == "accepted"
        assert req.accepted_by == donor.name

    def test_decline_request(self, client, donor, recipient, db):
        from app.models import FoodRequest

        req = FoodRequest(
            recipient_id=recipient.id,
            food_name="Fruits",
            quantity="1 kg",
            status="pending",
            location="Kandy",
        )
        db.add(req)
        db.commit()
        db.refresh(req)

        res = client.put(f"/api/requests/{req.id}/respond", json={
            "request_id": req.id,
            "status": "declined",
            "user_id": donor.id,
            "user_name": donor.name,
        })
        assert res.status_code == 200
        db.refresh(req)
        assert req.status == "declined"


class TestPayhereInitiate:
    def test_payhere_initiate_returns_hash(self, client):
        res = client.post("/api/donations/payhere/initiate", json={
            "name": "Test Donor",
            "email": "pytest_payhere@example.com",
            "amount": 4000.0,
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        params = data["params"]
        assert "hash" in params
        assert len(params["hash"]) == 32  # MD5 hex length
        assert params["currency"] == "LKR"
        assert params["amount"] == "4000.00"
        assert params["merchant_id"] is not None
        assert "order_id" in params
        assert params["order_id"].startswith("SE-")
