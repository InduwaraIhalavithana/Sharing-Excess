"""Regression tests for problems found by the full audit: oversize or odd input must give a clean 4xx (never a 500),
suspended users cannot reactivate themselves, events cannot be moved into the past, and e-mail headers cannot be injected."""
import uuid

import pytest

from tests.conftest import in_hours, listing_form, png_bytes


class TestListingInputLimits:
    @pytest.mark.parametrize("over, needle", [
        ({"area": "x" * 121}, "area"),
        ({"description": "d" * 2001}, "description"),
        ({"pickup_address": "p" * 501}, "pickup address"),
        ({"contact_phone": "9" * 30}, "phone"),
        ({"quantity_total": "NaN"}, "number"),
        ({"quantity_total": "Infinity"}, "number"),
        ({"quantity_total": "-Infinity"}, "number"),
        ({"food_name": "x" * 256}, "food name"),
    ])
    def test_rejected_cleanly(self, client, make_user, post_listing, over, needle):
        res = post_listing(make_user("donor"), expect=400, **over)
        assert needle in res.json()["detail"].lower()

    def test_line_breaks_in_the_name_become_spaces(self, client, make_user, post_listing):
        item = post_listing(make_user("donor"), food_name="pytest_ two\nlines\tof name")
        assert "\n" not in item["food_name"] and "\t" not in item["food_name"]

    def test_edit_applies_the_same_limits(self, client, make_user, post_listing):
        d = make_user("donor")
        item = post_listing(d)
        for body in ({"area": "a" * 121}, {"description": "d" * 2001}, {"pickup_address": "p" * 501}, {"food_name": "x"}):
            assert client.put(f"/api/listings/{item['id']}", headers=d.h, json=body).status_code == 422, body


class TestQueryParameters:
    def test_unknown_status_filters_are_a_400_not_a_500(self, client, make_user, post_listing):
        d, r = make_user("donor"), make_user("recipient")
        assert client.get("/api/requests?status=zzz", headers=r.h).status_code == 400
        assert client.get("/api/requests?status=pending,zzz", headers=d.h).status_code == 400
        assert client.get("/api/requests?status=,", headers=d.h).status_code == 400
        assert client.get(f"/api/listings?donor_id={d.id}&status=zzz", headers=d.h).status_code == 400
        assert client.get("/api/requests?status=pending,accepted", headers=d.h).status_code == 200
        assert client.get(f"/api/listings?donor_id={d.id}&status=active", headers=d.h).status_code == 200

    def test_paging_extremes_are_survivable(self, client):
        for qs in ("page=0", "page=-5", "limit=0", "limit=-1", "limit=1000000", "page=99999999999", "q=%25"):
            assert client.get("/api/listings?" + qs).status_code == 200, qs


class TestAccountInputLimits:
    def _signup(self, client, **over):
        body = {"name": "Pytest Limits", "email": f"pytest_lim_{uuid.uuid4().hex[:8]}@example.com", "password": "password123",
                "role": "recipient", "district": "Colombo", **over}
        return client.post("/api/auth/signup", json=body)

    def test_signup_limits(self, client):
        for over in ({"location": "l" * 256}, {"name": "n" * 101}, {"name": "x"}, {"password": "p" * 129},
                     {"role": "ngo", "org_name": "o" * 201}, {"role": "ngo", "org_name": "Fine Org", "org_description": "d" * 2001}):
            assert self._signup(client, **over).status_code == 422, over
        assert self._signup(client, location="l" * 255, name="n" * 100).status_code == 200

    def test_profile_limits(self, client, make_user):
        u = make_user("recipient")
        assert client.put("/api/auth/me", headers=u.h, json={"name": "Okay Name", "location": "l" * 256}).status_code == 422
        assert client.put("/api/auth/me", headers=u.h, json={"name": "n" * 101}).status_code == 422

    def test_feedback_and_contact_limits(self, client, make_user):
        u = make_user("recipient")
        assert client.post("/api/feedback", headers=u.h, data={"comment": "c" * 3001}).status_code == 400
        res = client.post("/api/contact", json={"name": "N", "email": "a@b.co", "message": "m" * 3001})
        assert res.status_code == 422


class TestSuspendedAccountsStayOut:
    def test_a_suspended_user_cannot_reactivate_with_a_mailed_code(self, client, make_user, db):
        u = make_user("recipient", status="suspended", verification_code="654321")
        res = client.post("/api/auth/verify-email", json={"user_id": u.id, "code": "654321"})
        assert res.status_code == 400
        db.expire_all()
        assert db.get(type(u.user), u.id).status == "suspended"

    def test_an_active_user_cannot_use_verify_either(self, client, make_user):
        u = make_user("recipient", verification_code="111222")
        assert client.post("/api/auth/verify-email", json={"user_id": u.id, "code": "111222"}).status_code == 400

    def test_reset_password_needs_a_real_code(self, client, make_user):
        u = make_user("recipient", verification_code=None)
        for code in ("", "000000", "None"):
            res = client.post("/api/auth/reset-password", json={"email": u.email, "code": code, "new_password": "newpassword1"})
            assert res.status_code == 400, code
        assert client.post("/api/auth/reset-password", json={"email": u.email, "code": "x", "new_password": "p" * 129}).status_code == 400


class TestEventsCannotMoveIntoThePast:
    def test_update_to_a_past_start_is_refused_but_other_edits_work(self, client, make_user):
        ngo = make_user("ngo")
        body = {"title": "pytest_ Past move", "location": "Hall", "district": "Galle", "event_type": "other",
                "starts_at": in_hours(48) + ":00", "contact_name": "Kamal", "contact_phone": "0771234567"}
        ev = client.post("/api/community-events", headers=ngo.h, json=body).json()["event"]
        past = client.put(f"/api/community-events/{ev['id']}", headers=ngo.h, json={**body, "starts_at": "2000-01-01T10:00:00"})
        assert past.status_code == 400
        same_time_new_title = client.put(f"/api/community-events/{ev['id']}", headers=ngo.h, json={**body, "title": "pytest_ Renamed"})
        assert same_time_new_title.status_code == 200


class TestEmailHeaders:
    def test_a_line_break_in_the_subject_cannot_add_a_header(self, monkeypatch):
        from app.utils import email as mailer

        sent = {}

        class FakeSMTP:
            def __init__(self, *a, **k): ...
            def __enter__(self): return self
            def __exit__(self, *a): return False
            def login(self, *a): ...
            def sendmail(self, frm, to, message): sent["msg"] = message

        monkeypatch.setattr(mailer.settings, "mail_username", "x@example.com")
        monkeypatch.setattr(mailer.settings, "mail_password", "pw")
        monkeypatch.setattr(mailer.smtplib, "SMTP_SSL", FakeSMTP)
        assert mailer.send_email("to@example.com", "Hello\nBcc: evil@example.com", "<p>x</p>") is True
        headers = sent["msg"].split("\n\n", 1)[0]
        assert "Bcc:" not in headers.replace("Subject: Hello Bcc: evil@example.com", "")
        assert not any(line.startswith("Bcc:") for line in sent["msg"].splitlines())


class TestAdminDeleteListingCleansReports:
    def test_reports_about_a_deleted_listing_go_with_it(self, client, make_user, post_listing, admin, db):
        from app.models import Report
        item = post_listing(make_user("donor"))
        client.post("/api/reports", json={"target_type": "listing", "target_id": item["id"], "reason": "pytest_ will vanish"})
        assert db.query(Report).filter(Report.target_type == "listing", Report.target_id == item["id"]).count() == 1
        assert client.delete(f"/api/admin/listings/{item['id']}", headers=admin.h).status_code == 200
        db.expire_all()
        assert db.query(Report).filter(Report.target_type == "listing", Report.target_id == item["id"]).count() == 0


def test_png_helper_still_valid():
    assert png_bytes()[:4] == b"\x89PNG" and listing_form()["unit"] == "portions"


class TestQuantitiesThatRoundToZero:
    def test_a_request_for_less_than_a_hundredth_is_refused_not_a_500(self, client, make_user, post_listing, request_food, db):
        from tests.conftest import listing_row
        item = post_listing(make_user("donor"), quantity_total="10")
        for q in (0.001, 0.004, 0.0049):
            assert request_food(make_user("recipient"), item["id"], q).status_code == 422, q
        assert request_food(make_user("recipient"), item["id"], 0.01).status_code == 200
        assert float(listing_row(db, item["id"]).quantity_available) == 9.99

    def test_listing_quantity_too_small_or_edited_to_it(self, client, make_user, post_listing):
        d = make_user("donor")
        post_listing(d, expect=400, quantity_total="0.004")
        item = post_listing(d)
        assert client.put(f"/api/listings/{item['id']}", headers=d.h, json={"quantity_total": 0.004}).status_code == 422
