"""The single admin: users, NGO approval, moderation, reports, feedback, stats. And NGO signup."""
import uuid

import pytest


@pytest.fixture()
def admin_login(client, make_user):
    a = make_user("admin")
    res = client.post("/api/auth/admin-login", json={"email": a.email, "password": "testpass123"})
    assert res.status_code == 200, res.text
    return a


class TestAdminOnly:
    def test_every_admin_route_rejects_everyone_else(self, client, make_user):
        routes = [("get", "/api/admin/users"), ("get", "/api/admin/ngos"), ("get", "/api/admin/listings"),
                  ("get", "/api/admin/reports"), ("get", "/api/admin/feedback"), ("get", "/api/admin/stats"),
                  ("patch", "/api/admin/users/1/suspend"), ("delete", "/api/admin/users/1"),
                  ("post", "/api/admin/ngos/1/approve"), ("post", "/api/admin/listings/1/close")]
        for who in (None, make_user("donor"), make_user("recipient"), make_user("ngo")):
            for method, url in routes:
                res = getattr(client, method)(url, headers=who.h if who else {})
                assert res.status_code == (401 if who is None else 403), (who and who.user.role, method, url)

    def test_the_old_officer_routes_are_gone(self, client, admin):
        assert client.get("/api/officer/users", headers=admin.h).status_code == 404
        assert client.post("/api/auth/officer-login", json={"email": admin.email, "password": "x"}).status_code == 404

    def test_admin_login_is_admins_only(self, client, make_user):
        d = make_user("donor")
        assert client.post("/api/auth/admin-login", json={"email": d.email, "password": "testpass123"}).status_code == 401

    def test_there_is_no_way_to_become_admin_through_the_api(self, client):
        email = f"pytest_sneaky_{uuid.uuid4().hex[:6]}@example.com"
        res = client.post("/api/auth/signup", json={"name": "Sneaky", "email": email, "password": "password123",
                                                    "role": "admin", "district": "Colombo"})
        assert res.status_code == 400


class TestUsers:
    def test_list_filter_suspend_update_delete_and_admin_is_protected(self, client, make_user, admin_login):
        a = admin_login
        u = make_user("recipient", name="Pytest Findable")
        rows = client.get("/api/admin/users?q=Pytest Findable", headers=a.h).json()["users"]
        assert [x["id"] for x in rows] == [u.id]
        assert all(x["role"] != "admin" for x in client.get("/api/admin/users", headers=a.h).json()["users"])
        assert {x["role"] for x in client.get("/api/admin/users?role=ngo", headers=a.h).json()["users"]} <= {"ngo"}
        assert client.patch(f"/api/admin/users/{u.id}/suspend", headers=a.h).json()["status"] == "suspended"
        assert client.get("/api/auth/me", headers=u.h).status_code == 403     # a suspended user is locked out
        assert client.patch(f"/api/admin/users/{u.id}/suspend", headers=a.h).json()["status"] == "active"
        assert client.put(f"/api/admin/users/{u.id}", headers=a.h, json={"district": "Galle"}).status_code == 200
        assert client.put(f"/api/admin/users/{u.id}", headers=a.h, json={"status": "pending"}).status_code == 422
        assert client.patch(f"/api/admin/users/{a.id}/suspend", headers=a.h).status_code == 403
        assert client.delete(f"/api/admin/users/{a.id}", headers=a.h).status_code == 403
        assert client.delete(f"/api/admin/users/{u.id}", headers=a.h).status_code == 200
        assert client.delete(f"/api/admin/users/{u.id}", headers=a.h).status_code == 404

    def test_deleting_a_donor_removes_their_food_and_tells_open_requesters(self, client, make_user, post_listing,
                                                                            request_food, admin_login):
        d, r = make_user("donor"), make_user("recipient")
        item = post_listing(d)
        request_food(r, item["id"], 1)
        assert client.delete(f"/api/admin/users/{d.id}", headers=admin_login.h).status_code == 200
        assert client.get(f"/api/listings/{item['id']}").status_code == 404
        assert any("closed their account" in n["title"] for n in client.get("/api/notifications", headers=r.h).json()["notifications"])


class TestNgoApproval:
    def _signup(self, client, **over):
        email = f"pytest_ngo_{uuid.uuid4().hex[:6]}@example.com"
        body = {"name": "Pytest Founder", "email": email, "password": "password123", "role": "ngo",
                "district": "Kandy", "org_name": "Pytest Hope Trust", "org_description": "We feed people", **over}
        return client.post("/api/auth/signup", json=body), email

    def test_signup_creates_a_pending_ngo(self, client, db):
        from app.models import User
        res, email = self._signup(client)
        assert res.status_code == 200, res.text
        u = db.query(User).filter(User.email == email).one()
        assert (u.role, u.ngo_status, u.org_name, u.district) == ("ngo", "pending", "Pytest Hope Trust", "Kandy")

    def test_ngo_signup_needs_an_organisation_name_and_everyone_needs_a_district(self, client):
        assert self._signup(client, org_name="")[0].status_code == 422
        assert self._signup(client, district="Atlantis")[0].status_code == 422
        body = {"name": "No District", "email": "pytest_nd@example.com", "password": "password123", "role": "donor"}
        assert client.post("/api/auth/signup", json=body).status_code == 422

    def test_donors_and_recipients_do_not_get_an_ngo_status(self, client, db):
        from app.models import User
        email = f"pytest_plain_{uuid.uuid4().hex[:6]}@example.com"
        client.post("/api/auth/signup", json={"name": "Plain", "email": email, "password": "password123",
                                              "role": "recipient", "district": "Galle", "org_name": "Ignored"})
        u = db.query(User).filter(User.email == email).one()
        assert u.ngo_status is None and u.org_name is None

    def test_approve_unlocks_events_and_requests_and_notifies(self, client, make_user, admin_login, post_listing,
                                                               request_food, outbox):
        pending = make_user("ngo", ngo_status="pending", org_name="pytest_ Waiting Org")
        item = post_listing(make_user("donor"))
        assert request_food(pending, item["id"], 1).status_code == 403
        listed = client.get("/api/admin/ngos?status=pending", headers=admin_login.h).json()["ngos"]
        assert pending.id in [n["id"] for n in listed]
        assert client.post(f"/api/admin/ngos/{pending.id}/approve", headers=admin_login.h).status_code == 200
        assert request_food(pending, item["id"], 1).status_code == 200
        assert any(m["to"] == pending.email and "approved" in m["subject"].lower() for m in outbox)
        assert any(n["kind"] == "ngo_approved" for n in client.get("/api/notifications", headers=pending.h).json()["notifications"])
        assert pending.id in [n["id"] for n in client.get("/api/ngos?q=pytest_ Waiting").json()["ngos"]]

    def test_reject_needs_a_reason_and_keeps_the_ngo_out(self, client, make_user, admin_login, post_listing, request_food):
        ngo = make_user("ngo", ngo_status="pending", org_name="pytest_ Rejected Org")
        assert client.post(f"/api/admin/ngos/{ngo.id}/reject", headers=admin_login.h, json={}).status_code == 400
        res = client.post(f"/api/admin/ngos/{ngo.id}/reject", headers=admin_login.h, json={"reason": "Could not verify"})
        assert res.status_code == 200 and res.json()["ngo_status"] == "rejected"
        assert request_food(ngo, post_listing(make_user("donor"))["id"], 1).status_code == 403
        assert ngo.id not in [n["id"] for n in client.get("/api/ngos?q=pytest_ Rejected").json()["ngos"]]
        assert client.post("/api/admin/ngos/99999999/approve", headers=admin_login.h).status_code == 404

    def test_a_non_ngo_cannot_be_approved(self, client, make_user, admin_login):
        assert client.post(f"/api/admin/ngos/{make_user('donor').id}/approve", headers=admin_login.h).status_code == 404


class TestModeration:
    def test_admin_closes_a_listing_and_the_donor_and_requesters_hear_why(self, client, make_user, post_listing,
                                                                          request_food, admin_login, db):
        from tests.conftest import listing_row
        d, r = make_user("donor"), make_user("recipient")
        item = post_listing(d, quantity_total="5")
        rid = request_food(r, item["id"], 2).json()["request"]["id"]
        res = client.post(f"/api/admin/listings/{item['id']}/close", headers=admin_login.h, json={"reason": "Reported as unsafe"})
        assert res.status_code == 200
        assert listing_row(db, item["id"]).status == "closed"
        got = client.get(f"/api/requests/{rid}", headers=r.h).json()["request"]
        assert got["status"] == "declined" and "unsafe" in got["decline_reason"]
        bell = client.get("/api/notifications", headers=d.h).json()["notifications"]
        assert any(n["kind"] == "listing_removed" and "unsafe" in n["body"] for n in bell)

    def test_admin_hard_deletes_a_listing_with_its_requests(self, client, make_user, post_listing, request_food,
                                                            admin_login, db):
        from app.models import FoodRequest
        item = post_listing(make_user("donor"))
        rid = request_food(make_user("recipient"), item["id"], 1).json()["request"]["id"]
        assert client.delete(f"/api/admin/listings/{item['id']}", headers=admin_login.h).status_code == 200
        db.expire_all()
        assert db.get(FoodRequest, rid) is None
        assert client.delete(f"/api/admin/listings/{item['id']}", headers=admin_login.h).status_code == 404

    def test_admin_listing_overview_and_status_filter(self, client, make_user, post_listing, admin_login):
        item = post_listing(make_user("donor"))
        rows = client.get("/api/admin/listings?status=active", headers=admin_login.h).json()["listings"]
        assert item["id"] in [x["id"] for x in rows]
        assert all(x["status"] == "active" for x in rows)

    def test_the_admin_has_no_quality_checks_or_verification_endpoints(self, client, admin):
        for url in ("/api/admin/listings/pending", "/api/admin/listings/1/verify", "/api/admin/escalations"):
            assert client.get(url, headers=admin.h).status_code in (404, 405)


class TestReportsAndFeedback:
    def test_review_a_report(self, client, make_user, post_listing, admin_login):
        item = post_listing(make_user("donor"))
        client.post("/api/reports", json={"target_type": "listing", "target_id": item["id"], "reason": "pytest_ review me"})
        rep = next(x for x in client.get("/api/admin/reports?status=open", headers=admin_login.h).json()["reports"]
                   if x["reason"] == "pytest_ review me")
        assert client.patch(f"/api/admin/reports/{rep['id']}", headers=admin_login.h, json={"status": "bogus"}).status_code == 400
        assert client.patch(f"/api/admin/reports/{rep['id']}", headers=admin_login.h,
                            json={"status": "actioned", "admin_note": "Removed"}).status_code == 200
        done = next(x for x in client.get("/api/admin/reports?status=actioned", headers=admin_login.h).json()["reports"] if x["id"] == rep["id"])
        assert done["admin_note"] == "Removed"
        assert client.patch("/api/admin/reports/99999999", headers=admin_login.h, json={"status": "open"}).status_code == 404

    def test_feedback_from_any_role_reaches_the_admin_and_can_be_resolved(self, client, make_user, admin_login):
        for role in ("donor", "recipient", "ngo"):
            who = make_user(role)
            res = client.post("/api/feedback", headers=who.h, data={"comment": f"pytest_ idea from {role}", "rating": "4"})
            assert res.status_code == 200, res.text
        rows = client.get("/api/admin/feedback", headers=admin_login.h).json()["feedback"]
        mine = [x for x in rows if x["comment"].startswith("pytest_ idea from")]
        assert {x["author_role"] for x in mine} == {"donor", "recipient", "ngo"}
        fid = mine[0]["id"]
        assert client.post(f"/api/admin/feedback/{fid}/resolve", headers=admin_login.h, json={"reply": "Thanks!"}).status_code == 200
        assert client.patch(f"/api/admin/feedback/{fid}/reopen", headers=admin_login.h).status_code == 200
        assert client.delete(f"/api/admin/feedback/{fid}", headers=admin_login.h).status_code == 200

    def test_feedback_validation_and_the_admin_does_not_send_it(self, client, make_user, admin):
        d = make_user("donor")
        assert client.post("/api/feedback", headers=d.h, data={"comment": "  "}).status_code == 400
        assert client.post("/api/feedback", headers=d.h, data={"comment": "pytest_ x", "rating": "9"}).status_code == 400
        assert client.post("/api/feedback", headers=admin.h, data={"comment": "pytest_ hi"}).status_code == 403
        assert client.post("/api/feedback", data={"comment": "pytest_ hi"}).status_code == 401
        assert client.post("/api/feedback", headers=d.h, data={"comment": "pytest_ x", "request_id": "99999999"}).status_code == 404

    def test_feedback_can_be_attached_to_a_completed_handover_once(self, client, make_user, post_listing, request_food):
        d, r = make_user("donor"), make_user("recipient")
        item = post_listing(d)
        rid = request_food(r, item["id"], 1).json()["request"]["id"]
        assert client.post("/api/feedback", headers=r.h, data={"comment": "pytest_ early", "request_id": str(rid)}).status_code == 400
        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"})
        client.put(f"/api/requests/{rid}/status", headers=d.h, json={"status": "completed"})
        assert client.post("/api/feedback", headers=r.h, data={"comment": "pytest_ ok", "request_id": str(rid)}).status_code == 200
        assert client.post("/api/feedback", headers=r.h, data={"comment": "pytest_ twice", "request_id": str(rid)}).status_code == 400
        assert client.post("/api/feedback", headers=make_user("recipient").h,
                           data={"comment": "pytest_ intruder", "request_id": str(rid)}).status_code == 404


class TestStats:
    def test_shape_and_counts_move(self, client, make_user, post_listing, request_food, admin_login):
        before = client.get("/api/admin/stats", headers=admin_login.h).json()
        d = make_user("donor")
        item = post_listing(d)
        rid = request_food(make_user("recipient"), item["id"], 1).json()["request"]["id"]
        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"})
        client.put(f"/api/requests/{rid}/status", headers=d.h, json={"status": "completed"})
        after = client.get("/api/admin/stats", headers=admin_login.h).json()
        for key in ("total_users", "users_by_role", "pending_ngos", "listings_by_status", "listings_by_district",
                    "requests_by_status", "handovers_completed", "open_reports", "open_feedback", "upcoming_events",
                    "top_categories", "completed_by_month"):
            assert key in after, key
        assert after["total_listings"] == before["total_listings"] + 1
        assert after["handovers_completed"] == before["handovers_completed"] + 1

    def test_public_stats_are_counts_only(self, client):
        res = client.get("/api/public/stats")
        assert res.status_code == 200
        body = res.json()
        assert {"listings_available", "handovers_completed", "districts_covered", "ngos", "events_upcoming"} <= set(body)
        assert all(isinstance(v, (int, bool)) for k, v in body.items())

    def test_meta_lists(self, client):
        body = client.get("/api/meta").json()
        assert len(body["districts"]) == 25 and "Colombo" in body["neighbours"]["Gampaha"]
        assert "cooked_meals" in body["categories"] and "kg" in body["units"]
        for a, ns in body["neighbours"].items():          # "near" is symmetric
            for b in ns:
                assert a in body["neighbours"][b]
