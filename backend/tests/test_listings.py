"""Integration tests for /api/listings endpoints."""
import io
import uuid


def _png_bytes() -> bytes:
    """Minimal valid 1x1 PNG for upload tests."""
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x00\x11\x00\x01\x9a`\x0e\x1b\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


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

    def test_own_listings_by_donor_id(self, client, donor, donor_token):
        res = client.get(f"/api/listings?donor_id={donor.id}", headers=bearer(donor_token))
        assert res.status_code == 200
        for listing in res.json()["listings"]:
            assert listing["donor_id"] == donor.id

    def test_donor_id_filter_requires_login(self, client, donor):
        # Unreviewed/rejected listings must not leak to anonymous callers
        assert client.get(f"/api/listings?donor_id={donor.id}").status_code == 401

    def test_cannot_view_another_donors_listings(self, client, donor, recipient_token):
        res = client.get(f"/api/listings?donor_id={donor.id}", headers=bearer(recipient_token))
        assert res.status_code == 403


class TestCreateListing:
    def test_create_listing_success(self, client, donor, donor_token, db):
        from app.models import FoodListing

        res = client.post("/api/listings", headers=bearer(donor_token), data={
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
        # New listings must await officer verification before going public
        assert data["listing"]["verification_status"] == "pending_review"

        listing = db.query(FoodListing).filter(FoodListing.id == data["listing"]["id"]).first()
        assert listing is not None
        assert listing.food_name == "Test Rice Bag"
        assert listing.donor_id == donor.id

    def test_donor_id_in_body_is_ignored(self, client, donor, donor_token, recipient):
        """The owner always comes from the token - a spoofed donor_id changes nothing."""
        res = client.post("/api/listings", headers=bearer(donor_token), data={
            "donor_id": str(recipient.id),
            "food_name": "Spoof Attempt",
            "quantity": "1 kg",
        })
        assert res.status_code == 200
        assert res.json()["listing"]["donor_id"] == donor.id

    def test_create_listing_with_image(self, client, donor, donor_token):
        res = client.post("/api/listings", headers=bearer(donor_token), data={
            "food_name": "Image Bread",
            "quantity": "5 loaves",
            "expiry_date": "2026-12-31",
            "location": "Kandy",
            "contact_phone": "0777654321",
            "contact_email": donor.email,
        }, files={"food_image": ("test.png", io.BytesIO(_png_bytes()), "image/png")})
        assert res.status_code == 200
        assert res.json()["success"] is True

    def test_create_listing_requires_login(self, client):
        res = client.post("/api/listings", data={"food_name": "Anon", "quantity": "1"})
        assert res.status_code == 401

    def test_recipient_cannot_create_listing(self, client, recipient_token):
        res = client.post("/api/listings", headers=bearer(recipient_token),
                          data={"food_name": "Nope", "quantity": "1"})
        assert res.status_code == 403

    def test_create_listing_missing_required_fields(self, client, donor_token):
        res = client.post("/api/listings", headers=bearer(donor_token), data={"quantity": "1 kg"})
        assert res.status_code == 422


class TestDeleteListing:
    def _make(self, db, donor_id, name="To Delete"):
        from app.models import FoodListing

        listing = FoodListing(donor_id=donor_id, food_name=name, quantity="1 unit", status="available")
        db.add(listing)
        db.commit()
        db.refresh(listing)
        return listing

    def test_delete_own_listing(self, client, donor, donor_token, db):
        from app.models import FoodListing

        listing = self._make(db, donor.id)
        res = client.delete(f"/api/listings/{listing.id}", headers=bearer(donor_token))
        assert res.status_code == 200
        assert db.query(FoodListing).filter(FoodListing.id == listing.id).first() is None

    def test_delete_requires_login(self, client, donor, db):
        listing = self._make(db, donor.id, "Anon Delete")
        # The old ?donor_id= query parameter must no longer authorise anything
        res = client.delete(f"/api/listings/{listing.id}?donor_id={donor.id}")
        assert res.status_code == 401

    def test_delete_listing_wrong_owner(self, client, recipient_token, db):
        from app.models import User
        from app.utils.security import hash_password

        other = User(
            name="Other Donor",
            email=f"pytest_other_{uuid.uuid4().hex[:6]}@example.com",
            password=hash_password("testpass123"), role="donor", status="active",
        )
        db.add(other)
        db.commit()
        db.refresh(other)
        listing = self._make(db, other.id, "Not Yours")

        res = client.delete(f"/api/listings/{listing.id}", headers=bearer(recipient_token))
        assert res.status_code == 403
