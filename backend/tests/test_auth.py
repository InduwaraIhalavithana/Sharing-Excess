"""Integration tests for /api/auth/* endpoints."""
import uuid


class TestSignup:
    def test_signup_success(self, client):
        email = f"pytest_signup_{uuid.uuid4().hex[:6]}@example.com"
        res = client.post("/api/auth/signup", json={
            "name": "Signup Test",
            "email": email,
            "password": "password123",
            "role": "recipient",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "user_id" in data
        assert data["role"] == "recipient"

    def test_signup_duplicate_email(self, client, donor):
        res = client.post("/api/auth/signup", json={
            "name": "Duplicate",
            "email": donor.email,
            "password": "password123",
            "role": "donor",
        })
        assert res.status_code == 400
        assert "already registered" in res.json()["detail"].lower()

    def test_signup_password_too_short(self, client):
        email = f"pytest_short_{uuid.uuid4().hex[:6]}@example.com"
        res = client.post("/api/auth/signup", json={
            "name": "Short Pass",
            "email": email,
            "password": "abc",
            "role": "recipient",
        })
        assert res.status_code == 400

    def test_signup_invalid_email(self, client):
        res = client.post("/api/auth/signup", json={
            "name": "Bad Email",
            "email": "not-an-email",
            "password": "password123",
            "role": "recipient",
        })
        assert res.status_code == 422  # pydantic validation


class TestLogin:
    def test_login_donor_success(self, client, donor):
        res = client.post("/api/auth/login", json={
            "email": donor.email,
            "password": "testpass123",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "token" in data
        assert data["user"]["role"] == "donor"

    def test_login_recipient_success(self, client, recipient):
        res = client.post("/api/auth/login", json={
            "email": recipient.email,
            "password": "testpass123",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["user"]["role"] == "recipient"

    def test_login_wrong_password(self, client, donor):
        res = client.post("/api/auth/login", json={
            "email": donor.email,
            "password": "wrongpassword",
        })
        assert res.status_code == 401

    def test_login_unknown_email(self, client):
        res = client.post("/api/auth/login", json={
            "email": "nobody@nowhere-example.com",
            "password": "password123",
        })
        assert res.status_code == 401

    def test_login_pending_user_blocked(self, client):
        email = f"pytest_pending_{uuid.uuid4().hex[:6]}@example.com"
        # Signup creates a pending user
        client.post("/api/auth/signup", json={
            "name": "Pending",
            "email": email,
            "password": "password123",
            "role": "recipient",
        })
        res = client.post("/api/auth/login", json={
            "email": email,
            "password": "password123",
        })
        assert res.status_code == 403


class TestVerifyEmail:
    def test_verify_email_success(self, client, db):
        from app.models import User
        from app.utils.security import generate_otp, hash_password

        code = generate_otp()
        email = f"pytest_verify_{uuid.uuid4().hex[:6]}@example.com"
        user = User(
            name="Verify Me",
            email=email,
            password=hash_password("password123"),
            role="recipient",
            status="pending",
            verification_code=code,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        res = client.post("/api/auth/verify-email", json={
            "user_id": user.id,
            "code": code,
        })
        assert res.status_code == 200
        assert res.json()["success"] is True

        # Now login should work
        login_res = client.post("/api/auth/login", json={
            "email": email,
            "password": "password123",
        })
        assert login_res.status_code == 200

    def test_verify_wrong_code(self, client, db):
        from app.models import User
        from app.utils.security import hash_password

        email = f"pytest_badcode_{uuid.uuid4().hex[:6]}@example.com"
        user = User(
            name="Bad Code",
            email=email,
            password=hash_password("password123"),
            role="recipient",
            status="pending",
            verification_code="123456",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        res = client.post("/api/auth/verify-email", json={
            "user_id": user.id,
            "code": "999999",
        })
        assert res.status_code == 400


class TestForgotPassword:
    def test_forgot_password_always_succeeds(self, client, donor):
        res = client.post("/api/auth/forgot-password", json={"email": donor.email})
        assert res.status_code == 200
        assert res.json()["success"] is True

    def test_forgot_unknown_email_still_succeeds(self, client):
        res = client.post("/api/auth/forgot-password", json={"email": "noone@nowhere-example.com"})
        assert res.status_code == 200
        assert res.json()["success"] is True


class TestAccountSettings:
    def _auth(self, token):
        return {"Authorization": f"Bearer {token}"}

    def test_me_requires_login(self, client):
        assert client.get("/api/auth/me").status_code == 401

    def test_get_and_update_profile(self, client, recipient, recipient_token):
        got = client.get("/api/auth/me", headers=self._auth(recipient_token)).json()["user"]
        assert got["email"] == recipient.email
        res = client.put("/api/auth/me", headers=self._auth(recipient_token),
                         json={"name": "Renamed Recipient", "phone_number": "077 123 4567", "location": "Galle"})
        assert res.status_code == 200
        assert res.json()["user"]["name"] == "Renamed Recipient"
        assert res.json()["user"]["location"] == "Galle"

    def test_profile_cannot_change_role_or_email(self, client, recipient, recipient_token):
        res = client.put("/api/auth/me", headers=self._auth(recipient_token),
                         json={"name": "Still Recipient", "role": "adminofficer", "email": "hijack@example.com"})
        assert res.status_code == 200
        assert res.json()["user"]["role"] == "recipient"
        assert res.json()["user"]["email"] == recipient.email

    def test_bad_phone_is_rejected(self, client, recipient_token):
        res = client.put("/api/auth/me", headers=self._auth(recipient_token),
                         json={"name": "Okay Name", "phone_number": "not-a-phone!"})
        assert res.status_code == 422

    def test_change_password_flow(self, client, db):
        import uuid

        from app.models import User
        from app.utils.security import hash_password

        u = User(name="Pw User", email=f"pytest_pw_{uuid.uuid4().hex[:6]}@example.com",
                 password=hash_password("oldpass123"), role="recipient", status="active")
        db.add(u)
        db.commit()
        tok = client.post("/api/auth/login", json={"email": u.email, "password": "oldpass123"}).json()["token"]
        h = self._auth(tok)
        assert client.post("/api/auth/change-password", headers=h,
                           json={"current_password": "WRONG", "new_password": "newpass123"}).status_code == 400
        assert client.post("/api/auth/change-password", headers=h,
                           json={"current_password": "oldpass123", "new_password": "short"}).status_code == 400
        assert client.post("/api/auth/change-password", headers=h,
                           json={"current_password": "oldpass123", "new_password": "oldpass123"}).status_code == 400
        ok = client.post("/api/auth/change-password", headers=h,
                         json={"current_password": "oldpass123", "new_password": "newpass123"})
        assert ok.status_code == 200
        assert client.post("/api/auth/login", json={"email": u.email, "password": "newpass123"}).status_code == 200
        assert client.post("/api/auth/login", json={"email": u.email, "password": "oldpass123"}).status_code == 401


class TestDeleteMyAccount:
    def _user(self, db, role):
        import uuid

        from app.models import User
        from app.utils.security import hash_password

        u = User(name=f"Pytest Leaver {role}", email=f"pytest_leave_{uuid.uuid4().hex[:6]}@example.com",
                 password=hash_password("leavepass123"), role=role, status="active")
        db.add(u)
        db.commit()
        db.refresh(u)
        return u

    def _login(self, client, u):
        return {"Authorization": "Bearer " + client.post("/api/auth/login", json={"email": u.email, "password": "leavepass123"}).json()["token"]}

    def test_requires_login_and_the_right_password(self, client, db):
        u = self._user(db, "recipient")
        assert client.request("DELETE", "/api/auth/me", json={"password": "x"}).status_code == 401
        h = self._login(client, u)
        assert client.request("DELETE", "/api/auth/me", json={"password": "wrong"}, headers=h).status_code == 400
        db.expire_all()
        assert db.get(type(u), u.id) is not None  # a wrong password deletes nothing

    def test_staff_cannot_self_delete(self, client, db):
        s = self._user(db, "adminofficer")
        res = client.post("/api/auth/officer-login", json={"email": s.email, "password": "leavepass123"})
        h = {"Authorization": "Bearer " + res.json()["token"]}
        assert client.request("DELETE", "/api/auth/me", json={"password": "leavepass123"}, headers=h).status_code == 403

    def test_a_recipient_is_removed_with_their_requests_feedback_and_photos(self, client, db):
        from app.models import Feedback, FoodRequest, User
        from app.utils.uploads import UPLOAD_DIR

        u = self._user(db, "recipient")
        photo = UPLOAD_DIR / "request_pytest_leaver.webp"
        photo.write_bytes(b"x")
        req = FoodRequest(recipient_id=u.id, food_name="Bye", quantity="1", status="delivered", image_path="/uploads/request_pytest_leaver.webp")
        db.add(req)
        db.commit()
        db.add(Feedback(recipient_id=u.id, request_id=req.id, comment="Thanks for everything", rating=5))
        db.commit()
        uid, rid = u.id, req.id

        res = client.request("DELETE", "/api/auth/me", json={"password": "leavepass123"}, headers=self._login(client, u))
        assert res.status_code == 200
        db.expire_all()
        assert db.get(User, uid) is None
        assert db.query(FoodRequest).filter(FoodRequest.id == rid).count() == 0
        assert db.query(Feedback).filter(Feedback.recipient_id == uid).count() == 0
        assert not photo.exists()

    def test_a_donor_leaves_but_other_peoples_requests_survive(self, client, db, recipient):
        from app.models import FoodListing, FoodRequest, User

        d = self._user(db, "donor")
        listing = FoodListing(donor_id=d.id, food_name="Leaving Soon", quantity="1", status="accepted",
                              verification_status="approved", accepted_by=d.name)
        db.add(listing)
        db.commit()
        req = FoodRequest(recipient_id=recipient.id, food_name="Leaving Soon", quantity="1", status="accepted",
                          listing_id=listing.id, accepted_by=d.name)
        db.add(req)
        db.commit()
        did, rid, lid = d.id, req.id, listing.id

        res = client.request("DELETE", "/api/auth/me", json={"password": "leavepass123"}, headers=self._login(client, d))
        assert res.status_code == 200
        db.expire_all()
        assert db.get(User, did) is None and db.get(FoodListing, lid) is None
        survivor = db.get(FoodRequest, rid)
        assert survivor is not None and survivor.listing_id is None
        assert survivor.accepted_by == "A former donor"  # the deleted donor's name is gone from others' history


class TestContactForm:
    body = {"name": "Visitor", "email": "pytest_visitor@example.com", "subject": "Hi", "message": "A message long enough to send."}

    def test_success_when_the_email_is_delivered(self, client):
        assert client.post("/api/contact", json=self.body).status_code == 200

    def test_a_failed_send_is_reported_not_hidden(self, client):
        from unittest.mock import patch

        with patch("app.routers.contact.send_email", return_value=False):
            res = client.post("/api/contact", json=self.body)
        assert res.status_code == 503 and "couldn't deliver" in res.json()["detail"]
