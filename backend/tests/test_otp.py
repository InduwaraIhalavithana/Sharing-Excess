"""E-mail codes: they expire, wrong guesses are counted, five wrong guesses kill the code, success clears it."""
from datetime import datetime, timedelta, timezone

import pytest

from app.services.otp import CODE_MINUTES, MAX_ATTEMPTS


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


@pytest.fixture()
def pending(make_user, db):
    from app.services.otp import issue_code
    acc = make_user("recipient", status="pending")
    code = issue_code(acc.user)
    db.commit()
    return acc, code


def verify(client, acc, code):
    return client.post("/api/auth/verify-email", json={"user_id": acc.id, "code": code})


def fresh(db, acc):
    db.expire_all()
    return db.get(type(acc.user), acc.id)


class TestVerificationCode:
    def test_the_right_code_works_once_and_is_then_cleared(self, client, db, pending):
        acc, code = pending
        assert verify(client, acc, code).status_code == 200
        u = fresh(db, acc)
        assert u.status == "active" and u.verification_code is None and u.verification_expires_at is None and u.verification_attempts == 0
        assert verify(client, acc, code).status_code == 400            # already verified

    def test_an_expired_code_is_refused_and_removed(self, client, db, pending):
        acc, code = pending
        u = fresh(db, acc)
        u.verification_expires_at = now() - timedelta(seconds=1)
        db.commit()
        res = verify(client, acc, code)
        assert res.status_code == 400 and "expired" in res.json()["detail"].lower()
        u = fresh(db, acc)
        assert u.status == "pending" and u.verification_code is None

    def test_a_code_without_an_expiry_is_never_accepted(self, client, db, pending):
        acc, code = pending
        u = fresh(db, acc)
        u.verification_expires_at = None
        db.commit()
        assert verify(client, acc, code).status_code == 400

    def test_wrong_guesses_are_counted_and_the_fifth_kills_the_code(self, client, db, pending):
        acc, code = pending
        for i in range(1, MAX_ATTEMPTS):
            assert verify(client, acc, "000000").status_code == 400
            assert fresh(db, acc).verification_attempts == i
        # a fresh pending user for the lock-out check
        from app.services.otp import issue_code
        u = fresh(db, acc)
        u.status = "pending"
        real = issue_code(u)
        db.commit()
        for _ in range(MAX_ATTEMPTS):
            assert verify(client, acc, "999999").status_code == 400
        assert fresh(db, acc).verification_code is None
        assert verify(client, acc, real).status_code == 400              # even the real code is dead now

    def test_asking_for_a_new_code_resets_the_counter_and_the_clock(self, client, db, pending, outbox):
        acc, code = pending
        for _ in range(MAX_ATTEMPTS):
            verify(client, acc, "999999")
        assert fresh(db, acc).verification_code is None
        assert client.post("/api/auth/resend-verification", json={"email": acc.email}).status_code == 200
        u = fresh(db, acc)
        assert u.verification_code and u.verification_attempts == 0
        assert timedelta(minutes=CODE_MINUTES - 1) < u.verification_expires_at - now() <= timedelta(minutes=CODE_MINUTES)
        mail = next(m for m in outbox if m["to"] == acc.email)
        assert u.verification_code in mail["html"] and "15 minutes" in mail["html"]
        assert verify(client, acc, u.verification_code).status_code == 200


class TestResetCode:
    def _ask(self, client, db, acc):
        client.post("/api/auth/forgot-password", json={"email": acc.email})
        return fresh(db, acc).verification_code

    def reset(self, client, acc, code, pw="brandnewpass1"):
        return client.post("/api/auth/reset-password", json={"email": acc.email, "code": code, "new_password": pw})

    def test_full_flow_then_the_code_cannot_be_reused(self, client, db, make_user):
        acc = make_user("recipient")
        code = self._ask(client, db, acc)
        assert self.reset(client, acc, code).status_code == 200
        assert client.post("/api/auth/login", json={"email": acc.email, "password": "brandnewpass1"}).status_code == 200
        assert self.reset(client, acc, code, "anotherpass22").status_code == 400

    def test_expired_and_over_guessed_reset_codes(self, client, db, make_user):
        acc = make_user("recipient")
        code = self._ask(client, db, acc)
        u = fresh(db, acc)
        u.verification_expires_at = now() - timedelta(minutes=1)
        db.commit()
        assert self.reset(client, acc, code).status_code == 400
        code = self._ask(client, db, acc)
        for _ in range(MAX_ATTEMPTS):
            assert self.reset(client, acc, "123123").status_code == 400
        assert self.reset(client, acc, code).status_code == 400
        # the password never changed
        assert client.post("/api/auth/login", json={"email": acc.email, "password": "testpass123"}).status_code == 200

    def test_unknown_email_gets_the_same_answer(self, client):
        res = client.post("/api/auth/reset-password", json={"email": "nobody_here@example.com", "code": "123456", "new_password": "brandnewpass1"})
        assert res.status_code == 400
