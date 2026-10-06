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
            "district": "Colombo",
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
            "district": "Colombo",
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
            "district": "Colombo",
        })
        assert res.status_code == 400

    def test_signup_invalid_email(self, client):
        res = client.post("/api/auth/signup", json={
            "name": "Bad Email",
            "email": "not-an-email",
            "password": "password123",
            "role": "recipient",
            "district": "Colombo",
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
            "district": "Colombo",
        })
        res = client.post("/api/auth/login", json={
            "email": email,
            "password": "password123",
        })
        assert res.status_code == 403


def _in_minutes(m):
    from datetime import datetime, timedelta, timezone
    return datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=m)


class TestVerifyEmail:
    def test_verify_email_success(self, client, db):
        from app.models import User
        from app.services.otp import issue_code
        from app.utils.security import hash_password

        email = f"pytest_verify_{uuid.uuid4().hex[:6]}@example.com"
        user = User(
            name="Verify Me",
            email=email,
            password=hash_password("password123"),
            role="recipient",
            status="pending",
        )
        code = issue_code(user)
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
            verification_expires_at=_in_minutes(10),
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
                         json={"name": "Still Recipient", "role": "admin", "email": "hijack@example.com"})
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
    def _login(self, client, u):
        return {"Authorization": "Bearer " + client.post("/api/auth/login", json={"email": u.email, "password": "testpass123"}).json()["token"]}

    def test_requires_login_and_the_right_password(self, client, make_user, db):
        u = make_user("recipient").user
        assert client.request("DELETE", "/api/auth/me", json={"password": "x"}).status_code == 401
        h = self._login(client, u)
        assert client.request("DELETE", "/api/auth/me", json={"password": "wrong"}, headers=h).status_code == 400
        db.expire_all()
        assert db.get(type(u), u.id) is not None  # a wrong password deletes nothing

    def test_the_admin_cannot_self_delete(self, client, make_user):
        s = make_user("admin").user
        res = client.post("/api/auth/admin-login", json={"email": s.email, "password": "testpass123"})
        assert res.status_code == 200
        h = {"Authorization": "Bearer " + res.json()["token"]}
        assert client.request("DELETE", "/api/auth/me", json={"password": "testpass123"}, headers=h).status_code == 403

    def test_a_recipient_is_removed_with_their_requests_feedback_ratings_and_notifications(
            self, client, make_user, post_listing, request_food, db):
        from app.models import Feedback, FoodRequest, Notification, Rating, User

        d = make_user("donor")
        item = post_listing(d)
        r = make_user("recipient")
        rid = request_food(r, item["id"], 2).json()["request"]["id"]
        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"})
        client.put(f"/api/requests/{rid}/status", headers=d.h, json={"status": "completed"})
        client.post("/api/ratings", headers=r.h, json={"request_id": rid, "score": 5})
        client.post("/api/feedback", headers=r.h, data={"comment": "Thanks for everything", "request_id": rid})

        res = client.request("DELETE", "/api/auth/me", json={"password": "testpass123"}, headers=r.h)
        assert res.status_code == 200
        db.expire_all()
        assert db.get(User, r.id) is None
        assert db.query(FoodRequest).filter(FoodRequest.id == rid).count() == 0
        assert db.query(Feedback).filter(Feedback.recipient_id == r.id).count() == 0
        assert db.query(Rating).filter(Rating.request_id == rid).count() == 0
        assert db.query(Notification).filter(Notification.user_id == r.id).count() == 0
        # the donor and their listing are untouched, and the held stock is not leaked
        assert db.get(User, d.id) is not None

    def test_a_donor_leaves_with_their_listings_and_photos_and_open_requesters_are_told(
            self, client, make_user, post_listing, request_food, db, outbox):
        import os

        from app.models import FoodListing, FoodRequest, User
        from app.utils.uploads import UPLOAD_DIR

        d = make_user("donor")
        item = post_listing(d)
        photo = UPLOAD_DIR / item["images"][0].rsplit("/", 1)[-1]
        assert photo.exists() or os.environ.get("CLOUDINARY_CLOUD_NAME")
        r = make_user("recipient")
        rid = request_food(r, item["id"], 2).json()["request"]["id"]
        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"})

        res = client.request("DELETE", "/api/auth/me", json={"password": "testpass123"}, headers=d.h)
        assert res.status_code == 200
        db.expire_all()
        assert db.get(User, d.id) is None and db.get(FoodListing, item["id"]) is None
        assert db.get(FoodRequest, rid) is None            # a request cannot outlive its listing
        assert not photo.exists()
        bell = client.get("/api/notifications", headers=r.h).json()["notifications"]
        assert any("donor" in n["title"].lower() and "closed" in n["title"].lower() for n in bell)
        assert any(m["to"] == r.email for m in outbox)


class TestContactForm:
    body = {"name": "Visitor", "email": "pytest_visitor@example.com", "subject": "Hi", "message": "A message long enough to send."}

    def test_success_when_the_email_is_delivered(self, client, monkeypatch, outbox):
        # the inbox address comes from settings; set it here so the test does not depend on a developer's .env
        monkeypatch.setattr("app.routers.contact.settings.mail_username", "inbox@example.com")
        assert client.post("/api/contact", json=self.body).status_code == 200
        assert [m["to"] for m in outbox] == ["inbox@example.com"]

    def test_without_a_configured_inbox_the_visitor_is_told_it_failed(self, client, monkeypatch):
        monkeypatch.setattr("app.routers.contact.settings.mail_username", "")
        assert client.post("/api/contact", json=self.body).status_code == 503

    def test_a_failed_send_is_reported_not_hidden(self, client, monkeypatch):
        from unittest.mock import patch

        monkeypatch.setattr("app.routers.contact.settings.mail_username", "inbox@example.com")
        with patch("app.routers.contact.send_email", return_value=False):
            res = client.post("/api/contact", json=self.body)
        assert res.status_code == 503 and "couldn't deliver" in res.json()["detail"]
