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
