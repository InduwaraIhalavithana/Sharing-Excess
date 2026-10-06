"""Community events: staff publish, anyone browses, signed-in users join, subscribers get notified."""
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from app.routers.community_events import now_colombo


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def iso(delta_days: float = 7, hours: float = 0) -> str:
    return (now_colombo() + timedelta(days=delta_days, hours=hours)).replace(microsecond=0).isoformat()


def payload(**over) -> dict:
    base = {"title": f"pytest_{uuid.uuid4().hex[:6]} Food Drive", "description": "Bring surplus food.",
            "location": "Colombo City Centre", "starts_at": iso(7), "ends_at": iso(7, 3), "capacity": 2}
    base.update(over)
    return base


@pytest.fixture(scope="module")
def staff(db):
    from app.models import User
    from app.utils.security import hash_password

    u = User(name="Pytest Events Staff", email=f"pytest_evstaff_{uuid.uuid4().hex[:6]}@example.com",
             password=hash_password("testpass123"), role="adminofficer", status="active")
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture(scope="module")
def staff_token(client, staff):
    return client.post("/api/auth/officer-login", json={"email": staff.email, "password": "testpass123"}).json()["token"]


def make_event(client, staff_token, **over):
    res = client.post("/api/community-events", headers=bearer(staff_token), json=payload(**over))
    assert res.status_code == 200, res.text
    return res.json()["event"]


def find(client, event_id, token=None):
    headers = bearer(token) if token else {}
    events = client.get("/api/community-events", headers=headers).json()["events"]
    return next(e for e in events if e["id"] == event_id)


class TestStaffManageEvents:
    def test_staff_can_create_edit_and_delete(self, client, staff_token):
        ev = make_event(client, staff_token)
        assert ev["capacity"] == 2 and ev["going"] == 0 and ev["spots_left"] == 2 and ev["is_past"] is False

        upd = client.put(f"/api/community-events/{ev['id']}", headers=bearer(staff_token),
                         json=payload(title="pytest_renamed event", capacity=5))
        assert upd.json()["event"]["title"] == "pytest_renamed event"

        assert client.delete(f"/api/community-events/{ev['id']}", headers=bearer(staff_token)).status_code == 200
        titles = [e["title"] for e in client.get("/api/community-events").json()["events"]]
        assert "pytest_renamed event" not in titles

    def test_only_staff_can_write(self, client, donor_token, recipient_token):
        for tok in (donor_token, recipient_token):
            assert client.post("/api/community-events", headers=bearer(tok), json=payload()).status_code == 403
        assert client.post("/api/community-events", json=payload()).status_code == 401

    @pytest.mark.parametrize("bad", [
        {"capacity": 0}, {"capacity": 20000}, {"title": "hi"}, {"location": ""},
        {"starts_at": iso(7), "ends_at": iso(6)},
    ])
    def test_validation(self, client, staff_token, bad):
        assert client.post("/api/community-events", headers=bearer(staff_token), json=payload(**bad)).status_code == 422

    def test_unlimited_capacity(self, client, staff_token):
        ev = make_event(client, staff_token, capacity=None)
        assert ev["spots_left"] is None and ev["full"] is False

    def test_capacity_cannot_drop_below_the_people_who_joined(self, client, staff_token, donor_token, recipient_token):
        ev = make_event(client, staff_token, capacity=3)
        client.post(f"/api/community-events/{ev['id']}/join", headers=bearer(donor_token))
        client.post(f"/api/community-events/{ev['id']}/join", headers=bearer(recipient_token))
        too_low = client.put(f"/api/community-events/{ev['id']}", headers=bearer(staff_token), json=payload(capacity=1))
        assert too_low.status_code == 400 and "already joined" in too_low.json()["detail"]
        ok = client.put(f"/api/community-events/{ev['id']}", headers=bearer(staff_token), json=payload(capacity=2))
        assert ok.status_code == 200


class TestJoining:
    def test_join_leave_and_counts(self, client, staff_token, donor_token, recipient_token):
        ev = make_event(client, staff_token, capacity=2)
        eid = ev["id"]
        assert client.post(f"/api/community-events/{eid}/join").status_code == 401

        assert client.post(f"/api/community-events/{eid}/join", headers=bearer(donor_token)).status_code == 200
        # joining twice is harmless
        assert client.post(f"/api/community-events/{eid}/join", headers=bearer(donor_token)).status_code == 200

        assert find(client, eid)["going"] == 1 and find(client, eid)["spots_left"] == 1
        assert find(client, eid, donor_token)["joined"] is True
        assert find(client, eid, recipient_token)["joined"] is False
        assert find(client, eid)["joined"] is False

        assert client.post(f"/api/community-events/{eid}/join", headers=bearer(recipient_token)).status_code == 200
        assert find(client, eid)["full"] is True

        assert client.delete(f"/api/community-events/{eid}/join", headers=bearer(donor_token)).status_code == 200
        assert find(client, eid)["going"] == 1 and find(client, eid)["full"] is False

    def test_a_full_event_turns_people_away(self, client, staff_token, donor_token, recipient_token):
        ev = make_event(client, staff_token, capacity=1)
        client.post(f"/api/community-events/{ev['id']}/join", headers=bearer(donor_token))
        res = client.post(f"/api/community-events/{ev['id']}/join", headers=bearer(recipient_token))
        assert res.status_code == 400 and "full" in res.json()["detail"]

    def test_cannot_join_a_past_event(self, client, staff_token, donor_token):
        ev = make_event(client, staff_token, starts_at=iso(-3), ends_at=iso(-3, 2))
        assert ev["is_past"] is True
        assert client.post(f"/api/community-events/{ev['id']}/join", headers=bearer(donor_token)).status_code == 400

    def test_staff_do_not_join(self, client, staff_token):
        ev = make_event(client, staff_token)
        assert client.post(f"/api/community-events/{ev['id']}/join", headers=bearer(staff_token)).status_code == 403

    def test_unknown_event(self, client, donor_token):
        assert client.post("/api/community-events/999999/join", headers=bearer(donor_token)).status_code == 404

    def test_attendee_list_is_staff_only_and_delete_removes_signups(self, client, staff_token, donor, donor_token, db):
        from app.models import EventSignup

        ev = make_event(client, staff_token)
        client.post(f"/api/community-events/{ev['id']}/join", headers=bearer(donor_token))
        assert client.get(f"/api/community-events/{ev['id']}/attendees", headers=bearer(donor_token)).status_code == 403
        people = client.get(f"/api/community-events/{ev['id']}/attendees", headers=bearer(staff_token)).json()["attendees"]
        assert [p["email"] for p in people] == [donor.email]
        client.delete(f"/api/community-events/{ev['id']}", headers=bearer(staff_token))
        assert db.query(EventSignup).filter(EventSignup.event_id == ev["id"]).count() == 0


class TestSubscribers:
    def test_subscribe_is_idempotent_and_does_not_reveal_who_is_subscribed(self, client, db):
        from app.models import EventSubscriber

        email = f"pytest_sub_{uuid.uuid4().hex[:6]}@example.com"
        a = client.post("/api/community-events/subscribe", json={"email": email})
        b = client.post("/api/community-events/subscribe", json={"email": email.upper()})
        assert a.status_code == b.status_code == 200 and a.json() == b.json()
        assert db.query(EventSubscriber).filter(EventSubscriber.email == email).count() == 1

    def test_bad_email_is_rejected(self, client):
        assert client.post("/api/community-events/subscribe", json={"email": "nope"}).status_code == 422

    def test_new_event_emails_subscribers(self, client, staff_token, db):
        from app.models import EventSubscriber

        email = f"pytest_sub_{uuid.uuid4().hex[:6]}@example.com"
        db.add(EventSubscriber(email=email))
        db.commit()
        with patch("app.routers.community_events.send_email", return_value=True) as sent:
            make_event(client, staff_token, title="pytest_ <b>Big</b> Drive")
        recipients = [c.args[0] for c in sent.call_args_list]
        assert email in recipients
        body = next(c.args[2] for c in sent.call_args_list if c.args[0] == email)
        assert "<b>Big</b>" not in body  # user text is escaped in the email


def test_events_are_public_and_sorted_by_date(client, staff_token):
    make_event(client, staff_token, starts_at=iso(30), ends_at=iso(30, 2))
    make_event(client, staff_token, starts_at=iso(10), ends_at=iso(10, 2))
    dates = [e["starts_at"] for e in client.get("/api/community-events").json()["events"]]
    assert dates == sorted(dates)
    assert datetime.fromisoformat(dates[0])
