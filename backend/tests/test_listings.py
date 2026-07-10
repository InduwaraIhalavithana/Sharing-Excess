"""Integration tests for /api/listings endpoints."""
import io
import pytest


def _png_bytes() -> bytes:
    """Minimal valid 1×1 PNG for upload tests."""
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x00\x11\x00\x01\x9a`\x0e\x1b\x00\x00\x00\x00IEND\xaeB`\x82"
    )


class TestGetListings:
    def test_get_listings_returns_list(self, client):
        res = client.get("/api/listings")
        assert res.status_code == 200
        data = res.json()
        assert "listings" in data
        assert isinstance(data["listings"], list)

    def test_search_listings(self, client):
        res = client.get("/api/listings?q=rice")
        assert res.status_code == 200
        assert "listings" in res.json()

    def test_filter_by_donor_id(self, client, donor):
        res = client.get(f"/api/listings?donor_id={donor.id}")
        assert res.status_code == 200
        data = res.json()
        assert "listings" in data
        for listing in data["listings"]:
            assert listing["donor_id"] == donor.id


class TestCreateListing:
    def test_create_listing_success(self, client, donor, db):
        from app.models import FoodListing

        res = client.post("/api/listings", data={
            "donor_id": str(donor.id),
            "food_name": "Test Rice Bag",
            "quantity": "10 kg",
            "expiry_date": "2026-12-31",
            "location": "Colombo 03",
            "description": "Good quality rice",
            "contact_phone": "0771234567",
            "contact_email": donor.email,
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "listing" in data and "id" in data["listing"]
        # New listings must await officer verification before going public
        assert data["listing"]["verification_status"] == "pending_review"

        # Verify stored in DB
        listing = db.query(FoodListing).filter(FoodListing.id == data["listing"]["id"]).first()
        assert listing is not None
        assert listing.food_name == "Test Rice Bag"
        assert listing.donor_id == donor.id

    def test_create_listing_with_image(self, client, donor):
        png = _png_bytes()
        res = client.post("/api/listings", data={
            "donor_id": str(donor.id),
            "food_name": "Image Bread",
            "quantity": "5 loaves",
            "expiry_date": "2026-12-31",
            "location": "Kandy",
            "contact_phone": "0777654321",
            "contact_email": donor.email,
        }, files={
            "food_image": ("test.png", io.BytesIO(png), "image/png"),
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True

    def test_create_listing_missing_required_fields(self, client, donor):
        res = client.post("/api/listings", data={
            "donor_id": str(donor.id),
            # food_name missing
            "quantity": "1 kg",
        })
        assert res.status_code == 422


class TestDeleteListing:
    def test_delete_listing_success(self, client, donor, db):
        from app.models import FoodListing

        # Create a listing to delete
        listing = FoodListing(
            donor_id=donor.id,
            food_name="To Delete",
            quantity="1 unit",
            status="available",
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)

        res = client.delete(f"/api/listings/{listing.id}?donor_id={donor.id}")
        assert res.status_code == 200
        assert res.json()["success"] is True

        # Confirm deleted
        gone = db.query(FoodListing).filter(FoodListing.id == listing.id).first()
        assert gone is None

    def test_delete_listing_wrong_owner(self, client, recipient, db):
        from app.models import FoodListing, User
        from app.utils.security import hash_password

        # Create a donor and a listing owned by them
        other_donor = User(
            name="Other Donor",
            email=f"pytest_other_{__import__('uuid').uuid4().hex[:6]}@example.com",
            password=hash_password("testpass123"),
            role="donor",
            status="active",
        )
        db.add(other_donor)
        db.commit()
        db.refresh(other_donor)

        listing = FoodListing(
            donor_id=other_donor.id,
            food_name="Not Yours",
            quantity="1 unit",
            status="available",
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)

        # Recipient tries to delete it
        res = client.delete(f"/api/listings/{listing.id}?donor_id={recipient.id}")
        assert res.status_code in (403, 404)
