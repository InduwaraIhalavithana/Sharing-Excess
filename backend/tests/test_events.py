"""NGO events and the NGO directory."""
import io
import uuid
from datetime import timedelta

import pytest

from app.utils.timeutil import now_colombo
from tests.conftest import png_bytes


def when(days: float = 3, hours: float = 0) -> str:
    return (now_colombo() + timedelta(days=days, hours=hours)).strftime("%Y-%m-%dT%H:%M:00")


def event_body(**over) -> dict:
    body = {"title": "pytest_ Community kitchen", "description": "Cooking together", "location": "Town hall, Galle",
            "district": "Galle", "event_type": "food_drive", "starts_at": when(3), "ends_at": when(3, 3),
            "capacity": 3, "contact_name": "Nimal", "contact_phone": "0771234567", "contact_email": ""}
    body.update(over)
    return body


@pytest.fixture()
def ngo(make_user):
    return make_user("ngo", district="Galle", org_name="Pytest Helpers", org_description="We help")


def create(client, ngo, **over):
    res = client.post("/api/community-events", headers=ngo.h, json=event_body(**over))
    assert res.status_code == 200, res.text
    return res.json()["event"]


class TestWhoCanPost:
    def test_only_approved_ngos_post_events(self, client, make_user):
        for who in (make_user("donor"), make_user("recipient"), make_user("admin"),
                    make_user("ngo", ngo_status="pending"), make_user("ngo", ngo_status="rejected")):
            res = client.post("/api/community-events", headers=who.h, json=event_body())
            assert res.status_code == 403, who.user.role
        assert client.post("/api/community-events", json=event_body()).status_code == 401

    def test_validation(self, client, ngo):
        cases = [{"title": "ab"}, {"district": "Atlantis"}, {"event_type": "party"}, {"capacity": 0},
                 {"ends_at": when(2)}, {"contact_phone": "", "contact_email": ""}, {"contact_name": ""},
                 {"contact_phone": "call me maybe"}]
        for over in cases:
            res = client.post("/api/community-events", headers=ngo.h, json=event_body(**over))
            assert res.status_code == 422, over
        past = client.post("/api/community-events", headers=ngo.h, json=event_body(starts_at=when(-1), ends_at=when(-1, 2)))
        assert past.status_code == 400

    def test_the_event_carries_type_district_contact_and_organiser(self, client, ngo):
        e = create(client, ngo)
        assert e["event_type"] == "food_drive" and e["district"] == "Galle" and e["status"] == "published"
        assert e["contact"]["name"] == "Nimal" and e["contact"]["phone"] == "0771234567"
        assert e["organiser"]["name"] == "Pytest Helpers"


class TestOwnership:
    def test_only_the_owner_edits_cancels_or_deletes(self, client, ngo, make_user, admin):
        e = create(client, ngo)
        other = make_user("ngo")
        assert client.put(f"/api/community-events/{e['id']}", headers=other.h, json=event_body()).status_code == 403
        assert client.post(f"/api/community-events/{e['id']}/cancel", headers=other.h).status_code == 403
        assert client.delete(f"/api/community-events/{e['id']}", headers=other.h).status_code == 403
        assert client.put(f"/api/community-events/{e['id']}", headers=ngo.h, json=event_body(title="pytest_ renamed")).status_code == 200
        # the admin may moderate (cancel / delete) but not edit
        assert client.put(f"/api/community-events/{e['id']}", headers=admin.h, json=event_body()).status_code == 403
        assert client.post(f"/api/community-events/{e['id']}/cancel", headers=admin.h).status_code == 200
        assert client.get(f"/api/community-events/{e['id']}").json()["event"]["status"] == "cancelled"
        assert client.delete(f"/api/community-events/{e['id']}", headers=admin.h).status_code == 200
        assert client.get(f"/api/community-events/{e['id']}").status_code == 404

    def test_capacity_cannot_drop_below_who_joined(self, client, ngo, make_user):
        e = create(client, ngo, capacity=5)
        for _ in range(3):
            assert client.post(f"/api/community-events/{e['id']}/join", headers=make_user("recipient").h).status_code == 200
        assert client.put(f"/api/community-events/{e['id']}", headers=ngo.h, json=event_body(capacity=2)).status_code == 400


class TestBrowsingAndFilters:
    def test_guests_browse_with_type_and_district_filters(self, client, ngo):
        tag = uuid.uuid4().hex[:6]
        a = create(client, ngo, title=f"pytest_ {tag} drive", event_type="food_drive", district="Galle")
        b = create(client, ngo, title=f"pytest_ {tag} class", event_type="workshop", district="Kandy")
        ids = lambda qs: {e["id"] for e in client.get(f"/api/community-events?q={tag}{qs}").json()["events"]}  # noqa: E731
        assert ids("") == {a["id"], b["id"]}
        assert ids("&event_type=workshop") == {b["id"]}
        assert ids("&district=Galle") == {a["id"]}
        assert ids("&district=Galle,Kandy&event_type=food_drive") == {a["id"]}
        assert client.get("/api/community-events?event_type=party").status_code == 400
        assert client.get("/api/community-events?district=Atlantis").status_code == 400

    def test_upcoming_hides_cancelled_events(self, client, ngo):
        tag = uuid.uuid4().hex[:6]
        a = create(client, ngo, title=f"pytest_ {tag} on")
        b = create(client, ngo, title=f"pytest_ {tag} off")
        client.post(f"/api/community-events/{b['id']}/cancel", headers=ngo.h)
        got = {e["id"] for e in client.get(f"/api/community-events?q={tag}&upcoming=true").json()["events"]}
        assert got == {a["id"]}


class TestJoining:
    def test_join_leave_capacity_and_rules(self, client, ngo, make_user, admin):
        e = create(client, ngo, capacity=2)
        r1, r2, r3 = (make_user("recipient") for _ in range(3))
        assert client.post(f"/api/community-events/{e['id']}/join", headers=r1.h).status_code == 200
        assert client.post(f"/api/community-events/{e['id']}/join", headers=r1.h).json()["message"].startswith("You have already")
        assert client.post(f"/api/community-events/{e['id']}/join", headers=r2.h).status_code == 200
        full = client.post(f"/api/community-events/{e['id']}/join", headers=r3.h)
        assert full.status_code == 400 and "full" in full.json()["detail"]
        assert client.delete(f"/api/community-events/{e['id']}/join", headers=r1.h).status_code == 200
        assert client.post(f"/api/community-events/{e['id']}/join", headers=r3.h).status_code == 200
        assert client.post(f"/api/community-events/{e['id']}/join", headers=admin.h).status_code == 403
        assert client.post(f"/api/community-events/{e['id']}/join", headers=ngo.h).status_code == 400   # the organiser
        assert client.post(f"/api/community-events/{e['id']}/join").status_code == 401

    def test_cancelled_events_cannot_be_joined(self, client, ngo, make_user):
        e = create(client, ngo)
        client.post(f"/api/community-events/{e['id']}/cancel", headers=ngo.h)
        assert client.post(f"/api/community-events/{e['id']}/join", headers=make_user("recipient").h).status_code == 400

    def test_only_the_organiser_sees_attendee_contact_details(self, client, ngo, make_user):
        e = create(client, ngo)
        r = make_user("recipient")
        client.post(f"/api/community-events/{e['id']}/join", headers=r.h)
        assert client.get(f"/api/community-events/{e['id']}/attendees", headers=ngo.h).json()["attendees"][0]["email"] == r.email
        assert client.get(f"/api/community-events/{e['id']}/attendees", headers=r.h).status_code == 403
        assert client.get(f"/api/community-events/{e['id']}/attendees", headers=make_user("ngo").h).status_code == 403


class TestImages:
    def test_up_to_three_photos_added_and_removed_by_the_owner(self, client, ngo, make_user):
        e = create(client, ngo)
        up = lambda who: client.post(f"/api/community-events/{e['id']}/images", headers=who.h,  # noqa: E731
                                     files={"image": ("e.png", io.BytesIO(png_bytes()), "image/png")})
        assert up(make_user("ngo")).status_code == 403
        urls = []
        for _ in range(3):
            res = up(ngo)
            assert res.status_code == 200, res.text
            urls = res.json()["images"]
        assert len(urls) == 3
        assert up(ngo).status_code == 400
        gone = client.delete(f"/api/community-events/{e['id']}/images", headers=ngo.h, params={"url": urls[0]})
        assert gone.status_code == 200 and len(gone.json()["images"]) == 2


class TestNotifications:
    def test_new_event_reaches_users_in_that_district_and_their_neighbours_not_others(self, client, ngo, make_user, outbox):
        near = make_user("recipient", district="Matara")        # Galle borders Matara
        same = make_user("donor", district="Galle")
        far = make_user("recipient", district="Jaffna")
        chosen = make_user("recipient", district="Jaffna", notify_districts=["Galle"])   # explicitly asked for Galle
        e = create(client, ngo)
        bell = lambda a: [n for n in client.get("/api/notifications", headers=a.h).json()["notifications"]  # noqa: E731
                          if n["kind"] == "new_event"]
        assert bell(near) and bell(same) and bell(chosen)
        assert not bell(far)
        assert not bell(ngo)                                    # not the organiser themself
        mailed = {m["to"] for m in outbox if "New event" in m["subject"]}
        assert {near.email, same.email, chosen.email} <= mailed and far.email not in mailed
        assert e["id"]

    def test_subscribers_get_the_email_too(self, client, ngo, db, outbox):
        from app.models import EventSubscriber
        sub = f"pytest_sub_{uuid.uuid4().hex[:6]}@example.com"
        db.add(EventSubscriber(email=sub))
        db.commit()
        create(client, ngo)
        assert any(m["to"] == sub for m in outbox)

    def test_subscribe_endpoint_answers_the_same_either_way(self, client):
        email = f"pytest_sub_{uuid.uuid4().hex[:6]}@example.com"
        first = client.post("/api/community-events/subscribe", json={"email": email}).json()
        second = client.post("/api/community-events/subscribe", json={"email": email}).json()
        assert first == second


class TestDirectory:
    def test_lists_only_approved_ngos_without_contact_details(self, client, make_user):
        ok = make_user("ngo", district="Kandy", org_name="pytest_ Good Org", org_description="Does good")
        pending = make_user("ngo", ngo_status="pending", org_name="pytest_ Pending Org")
        res = client.get("/api/ngos?q=pytest_").json()["ngos"]
        names = {n["org_name"] for n in res}
        assert "pytest_ Good Org" in names and "pytest_ Pending Org" not in names
        card = next(n for n in res if n["id"] == ok.id)
        assert "email" not in card and "phone" not in card and card["district"] == "Kandy"
        assert client.get(f"/api/ngos/{ok.id}").status_code == 200
        assert client.get(f"/api/ngos/{pending.id}").status_code == 404
        assert client.get("/api/ngos?district=Kandy&q=pytest_ Good").json()["ngos"][0]["id"] == ok.id

    def test_upcoming_event_count_shows_on_the_card(self, client, ngo):
        create(client, ngo)
        card = next(n for n in client.get("/api/ngos?q=Pytest Helpers").json()["ngos"] if n["id"] == ngo.id)
        assert card["upcoming_events"] >= 1

    def test_an_ngo_edits_its_own_profile_and_logo(self, client, ngo, make_user):
        res = client.put("/api/ngos/me", headers=ngo.h, data={"org_name": "Pytest Helpers 2", "org_description": "New text"},
                         files={"logo": ("l.png", io.BytesIO(png_bytes()), "image/png")})
        assert res.status_code == 200, res.text
        assert res.json()["user"]["org_name"] == "Pytest Helpers 2" and res.json()["user"]["org_logo"]
        assert client.put("/api/ngos/me", headers=make_user("donor").h, data={"org_name": "Nope Org"}).status_code == 403
