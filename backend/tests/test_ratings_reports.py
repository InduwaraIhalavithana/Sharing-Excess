"""Ratings both ways after a completed handover, and reports from anyone."""
import pytest


@pytest.fixture()
def done(client, make_user, post_listing, request_food):
    """A donor, a recipient and a request in a given state via done(state)."""
    d, r = make_user("donor"), make_user("recipient")
    item = post_listing(d)
    rid = request_food(r, item["id"], 2).json()["request"]["id"]

    def advance(state="completed"):
        if state in ("accepted", "collected", "completed"):
            client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"})
        if state in ("collected", "completed"):
            client.put(f"/api/requests/{rid}/status", headers=r.h, json={"status": "collected"})
        if state == "completed":
            client.put(f"/api/requests/{rid}/status", headers=d.h, json={"status": "completed"})
        return d, r, item, rid
    return advance


class TestRatings:
    def test_both_sides_rate_each_other_once(self, client, done):
        d, r, item, rid = done()
        assert client.post("/api/ratings", headers=r.h, json={"request_id": rid, "score": 5, "comment": "Lovely, thank you"}).status_code == 200
        assert client.post("/api/ratings", headers=d.h, json={"request_id": rid, "score": 4, "comment": "Arrived on time"}).status_code == 200
        again = client.post("/api/ratings", headers=r.h, json={"request_id": rid, "score": 1})
        assert again.status_code == 409
        donor_summary = client.get(f"/api/ratings/user/{d.id}").json()
        assert donor_summary["average"] == 5.0 and donor_summary["count"] == 1
        assert donor_summary["recent"][0]["comment"] == "Lovely, thank you"
        assert client.get(f"/api/ratings/user/{r.id}").json()["average"] == 4.0
        # raters appear by first name only
        assert donor_summary["recent"][0]["from"] == "Pytest"

    def test_only_after_the_handover_is_completed(self, client, done):
        for state in ("pending", "accepted", "collected"):
            d, r, item, rid = done(state)
            res = client.post("/api/ratings", headers=r.h, json={"request_id": rid, "score": 5})
            assert res.status_code == 400 and "completed" in res.json()["detail"], state

    def test_only_the_two_parties_can_rate(self, client, done, make_user, admin):
        d, r, item, rid = done()
        for who in (make_user("recipient"), make_user("donor"), admin):
            assert client.post("/api/ratings", headers=who.h, json={"request_id": rid, "score": 5}).status_code == 404
        assert client.post("/api/ratings", json={"request_id": rid, "score": 5}).status_code == 401

    def test_score_range_and_comment_length(self, client, done):
        d, r, item, rid = done()
        for bad in (0, 6, -1):
            assert client.post("/api/ratings", headers=r.h, json={"request_id": rid, "score": bad}).status_code == 422
        assert client.post("/api/ratings", headers=r.h, json={"request_id": rid, "score": 3, "comment": "x" * 501}).status_code == 422

    def test_can_rate_flag_on_the_request_and_donor_rating_on_the_listing(self, client, done):
        d, r, item, rid = done()
        assert client.get(f"/api/requests/{rid}", headers=r.h).json()["request"]["can_rate"] is True
        client.post("/api/ratings", headers=r.h, json={"request_id": rid, "score": 4})
        assert client.get(f"/api/requests/{rid}", headers=r.h).json()["request"]["can_rate"] is False
        assert client.get(f"/api/requests/{rid}", headers=d.h).json()["request"]["can_rate"] is True
        listing = client.get(f"/api/listings/{item['id']}").json()["listing"]
        assert listing["donor_rating"] == {"average": 4.0, "count": 1}

    def test_the_rated_user_is_told_and_unknown_users_404(self, client, done):
        d, r, item, rid = done()
        client.post("/api/ratings", headers=r.h, json={"request_id": rid, "score": 2, "comment": "Cold food"})
        kinds = [n["kind"] for n in client.get("/api/notifications", headers=d.h).json()["notifications"]]
        assert "rating_received" in kinds
        assert client.get("/api/ratings/user/99999999").status_code == 404

    def test_admin_is_not_ratable(self, client, admin):
        assert client.get(f"/api/ratings/user/{admin.id}").status_code == 404


class TestReports:
    def test_a_signed_in_user_reports_a_listing_and_the_admin_sees_it(self, client, make_user, post_listing, admin):
        item = post_listing(make_user("donor"))
        r = make_user("recipient")
        res = client.post("/api/reports", headers=r.h, json={"target_type": "listing", "target_id": item["id"], "reason": "pytest_ looks unsafe"})
        assert res.status_code == 200, res.text
        listed = client.get("/api/admin/reports?status=open", headers=admin.h).json()["reports"]
        mine = next(x for x in listed if x["reason"] == "pytest_ looks unsafe")
        assert mine["target_type"] == "listing" and mine["target_id"] == item["id"] and mine["reporter_id"] == r.id

    def test_guests_can_report_too(self, client, make_user, post_listing, admin):
        item = post_listing(make_user("donor"))
        res = client.post("/api/reports", json={"target_type": "listing", "target_id": item["id"], "reason": "pytest_ guest report"})
        assert res.status_code == 200
        row = next(x for x in client.get("/api/admin/reports", headers=admin.h).json()["reports"] if x["reason"] == "pytest_ guest report")
        assert row["reporter_id"] is None

    def test_duplicate_open_reports_by_one_user_are_collapsed(self, client, make_user, post_listing, admin):
        item = post_listing(make_user("donor"))
        r = make_user("recipient")
        body = {"target_type": "listing", "target_id": item["id"], "reason": "pytest_ dup report"}
        client.post("/api/reports", headers=r.h, json=body)
        client.post("/api/reports", headers=r.h, json=body)
        rows = [x for x in client.get("/api/admin/reports", headers=admin.h).json()["reports"] if x["reason"] == "pytest_ dup report"]
        assert len(rows) == 1

    def test_validation_and_missing_targets(self, client, make_user, post_listing):
        r = make_user("recipient")
        ok = {"target_type": "listing", "target_id": post_listing(make_user("donor"))["id"], "reason": "pytest_ fine reason"}
        assert client.post("/api/reports", headers=r.h, json={**ok, "target_type": "pizza"}).status_code == 422
        assert client.post("/api/reports", headers=r.h, json={**ok, "reason": "bad"}).status_code == 422
        assert client.post("/api/reports", headers=r.h, json={**ok, "target_id": 99999999}).status_code == 404
        assert client.post("/api/reports", headers=r.h, json={"target_type": "user", "target_id": r.id,
                                                              "reason": "pytest_ myself"}).status_code == 400

    def test_every_target_type_is_reportable(self, client, make_user, post_listing, request_food):
        d, r = make_user("donor"), make_user("recipient")
        item = post_listing(d)
        rid = request_food(r, item["id"], 1).json()["request"]["id"]
        targets = {"listing": item["id"], "user": d.id, "request": rid}
        for kind, tid in targets.items():
            res = client.post("/api/reports", headers=r.h, json={"target_type": kind, "target_id": tid, "reason": f"pytest_ report {kind}"})
            assert res.status_code == 200, (kind, res.text)
