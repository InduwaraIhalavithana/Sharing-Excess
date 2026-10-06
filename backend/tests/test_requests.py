"""Requests: partial quantities, stock held and returned, accept / decline, handover statuses, contact privacy,
concurrency, and the notifications each step produces."""
import threading

import pytest

from tests.conftest import listing_row


def avail(db, listing_id) -> float:
    return float(listing_row(db, listing_id).quantity_available)


@pytest.fixture()
def setup(make_user, post_listing):
    """A donor with a 10-portion listing, plus two recipients."""
    d = make_user("donor", phone_number="0770000001", district="Colombo")
    item = post_listing(d, quantity_total="10")
    return d, item, make_user("recipient"), make_user("recipient")


class TestMakingARequest:
    def test_holds_stock_and_supports_partial_amounts(self, client, setup, request_food, db):
        d, item, r1, r2 = setup
        res = request_food(r1, item["id"], 3, "For the children")
        assert res.status_code == 200, res.text
        assert res.json()["request"]["quantity_requested"] == 3 and res.json()["request"]["status"] == "pending"
        assert avail(db, item["id"]) == 7
        assert request_food(r2, item["id"], 7).status_code == 200
        assert avail(db, item["id"]) == 0
        assert listing_row(db, item["id"]).status == "sold_out"

    def test_cannot_take_more_than_remains(self, client, setup, request_food, db):
        d, item, r1, r2 = setup
        request_food(r1, item["id"], 8)
        res = request_food(r2, item["id"], 3)
        assert res.status_code == 400 and "2" in res.json()["detail"]
        assert avail(db, item["id"]) == 2

    def test_quantity_must_be_positive_and_numeric(self, client, setup, request_food):
        d, item, r1, _ = setup
        for bad in (0, -1, "abc"):
            assert request_food(r1, item["id"], bad).status_code == 422

    def test_who_may_request(self, client, setup, request_food, make_user):
        d, item, r1, _ = setup
        assert request_food(d, item["id"], 1).status_code == 403                               # donors
        assert request_food(make_user("admin"), item["id"], 1).status_code == 403
        pending_ngo = make_user("ngo", ngo_status="pending")
        res = request_food(pending_ngo, item["id"], 1)
        assert res.status_code == 403 and "approval" in res.json()["detail"]
        assert request_food(make_user("ngo"), item["id"], 1).status_code == 200                # approved NGO
        assert client.post("/api/requests", json={"listing_id": item["id"], "quantity_requested": 1}).status_code == 401

    def test_one_open_request_per_listing_per_person(self, client, setup, request_food, db):
        d, item, r1, _ = setup
        assert request_food(r1, item["id"], 2).status_code == 200
        assert request_food(r1, item["id"], 2).status_code == 409
        assert avail(db, item["id"]) == 8

    def test_unavailable_listings_cannot_be_requested(self, client, setup, request_food, make_user):
        d, item, r1, _ = setup
        assert request_food(r1, 99999999, 1).status_code == 404
        client.post(f"/api/listings/{item['id']}/close", headers=d.h)
        res = request_food(make_user("recipient"), item["id"], 1)
        assert res.status_code == 400 and "no longer available" in res.json()["detail"]


class TestStockComesBack:
    def test_decline_needs_a_reason_and_returns_stock(self, client, setup, request_food, db):
        d, item, r1, _ = setup
        rid = request_food(r1, item["id"], 4).json()["request"]["id"]
        no_reason = client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "declined"})
        assert no_reason.status_code == 400 and "reason" in no_reason.json()["detail"]
        assert avail(db, item["id"]) == 6
        ok = client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "declined", "reason": "Already promised"})
        assert ok.status_code == 200
        assert avail(db, item["id"]) == 10 and listing_row(db, item["id"]).status == "active"
        got = client.get(f"/api/requests/{rid}", headers=r1.h).json()["request"]
        assert got["status"] == "declined" and got["decline_reason"] == "Already promised"

    def test_declining_a_sold_out_listing_reopens_it(self, client, setup, request_food, db):
        d, item, r1, _ = setup
        rid = request_food(r1, item["id"], 10).json()["request"]["id"]
        assert listing_row(db, item["id"]).status == "sold_out"
        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "declined", "reason": "Sorry"})
        assert listing_row(db, item["id"]).status == "active"
        assert any(x["id"] == item["id"] for x in client.get("/api/listings?limit=100").json()["listings"])

    def test_recipient_cancel_returns_stock_pending_or_accepted(self, client, setup, request_food, db):
        d, item, r1, r2 = setup
        a = request_food(r1, item["id"], 3).json()["request"]["id"]
        b = request_food(r2, item["id"], 2).json()["request"]["id"]
        client.put(f"/api/requests/{b}/respond", headers=d.h, json={"status": "accepted"})
        assert avail(db, item["id"]) == 5
        for rid, who in ((a, r1), (b, r2)):
            res = client.put(f"/api/requests/{rid}/status", headers=who.h, json={"status": "cancelled"})
            assert res.status_code == 200, res.text
        assert avail(db, item["id"]) == 10

    def test_accepting_keeps_the_hold_and_does_not_double_count(self, client, setup, request_food, db):
        d, item, r1, _ = setup
        rid = request_food(r1, item["id"], 4).json()["request"]["id"]
        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"})
        assert avail(db, item["id"]) == 6

    def test_no_show_returns_stock_but_collected_and_completed_do_not(self, client, setup, request_food, db):
        d, item, r1, r2 = setup
        a = request_food(r1, item["id"], 3).json()["request"]["id"]
        b = request_food(r2, item["id"], 2).json()["request"]["id"]
        for rid in (a, b):
            client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"})
        assert client.put(f"/api/requests/{a}/status", headers=d.h, json={"status": "no_show"}).status_code == 200
        assert avail(db, item["id"]) == 8
        client.put(f"/api/requests/{b}/status", headers=d.h, json={"status": "collected"})
        client.put(f"/api/requests/{b}/status", headers=d.h, json={"status": "completed"})
        assert avail(db, item["id"]) == 8      # the 2 handed over are gone for good

    def test_stock_arithmetic_always_adds_up(self, client, setup, request_food, make_user, db):
        """available + sum(held requests) == total, after a mixed bag of operations."""
        from app.models import FoodRequest
        d, item, r1, r2 = setup
        r3 = make_user("recipient")
        ids = [request_food(r, item["id"], q).json()["request"]["id"] for r, q in ((r1, 2), (r2, 3), (r3, 1.5))]
        client.put(f"/api/requests/{ids[0]}/respond", headers=d.h, json={"status": "declined", "reason": "x"})
        client.put(f"/api/requests/{ids[1]}/respond", headers=d.h, json={"status": "accepted"})
        client.put(f"/api/requests/{ids[2]}/status", headers=r3.h, json={"status": "cancelled"})
        db.expire_all()
        held = sum(float(r.quantity_requested) for r in db.query(FoodRequest).filter(
            FoodRequest.listing_id == item["id"], FoodRequest.status.in_(("pending", "accepted", "collected", "completed"))))
        assert avail(db, item["id"]) + held == 10 == held + 7


class TestRespondPermissions:
    def test_only_the_listing_donor_can_answer(self, client, setup, request_food, make_user):
        d, item, r1, r2 = setup
        rid = request_food(r1, item["id"], 1).json()["request"]["id"]
        other_donor = make_user("donor")
        assert client.put(f"/api/requests/{rid}/respond", headers=other_donor.h, json={"status": "accepted"}).status_code == 404
        assert client.put(f"/api/requests/{rid}/respond", headers=r1.h, json={"status": "accepted"}).status_code == 403
        assert client.put(f"/api/requests/{rid}/respond", headers=make_user("admin").h, json={"status": "accepted"}).status_code == 403
        assert client.put(f"/api/requests/{rid}/respond", json={"status": "accepted"}).status_code == 401
        assert client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "pending"}).status_code == 400

    def test_an_answered_request_cannot_be_answered_again(self, client, setup, request_food):
        d, item, r1, _ = setup
        rid = request_food(r1, item["id"], 1).json()["request"]["id"]
        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"})
        res = client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "declined", "reason": "changed my mind"})
        assert res.status_code == 400 and "already accepted" in res.json()["detail"]

    def test_requests_are_private_to_their_two_parties(self, client, setup, request_food, make_user, admin):
        d, item, r1, r2 = setup
        rid = request_food(r1, item["id"], 1).json()["request"]["id"]
        assert client.get(f"/api/requests/{rid}", headers=r2.h).status_code == 404
        assert client.get(f"/api/requests/{rid}", headers=make_user("donor").h).status_code == 404
        assert client.get(f"/api/requests/{rid}", headers=d.h).status_code == 200
        assert client.get(f"/api/requests/{rid}", headers=admin.h).status_code == 200
        assert rid not in [x["id"] for x in client.get("/api/requests", headers=r2.h).json()["requests"]]


class TestContactIsSharedOnlyAfterAcceptance:
    def _contact_fields(self, req):
        return {k: v for k, v in {**{f"donor.{a}": b for a, b in req["donor"].items()},
                                  **{f"recipient.{a}": b for a, b in req["recipient"].items()}}.items()
                if k.split(".")[1] in ("phone", "email", "address")}

    def test_nothing_is_shared_while_pending(self, client, setup, request_food):
        d, item, r1, _ = setup
        rid = request_food(r1, item["id"], 2).json()["request"]["id"]
        for who in (d, r1):
            req = client.get(f"/api/requests/{rid}", headers=who.h).json()["request"]
            assert self._contact_fields(req) == {}, who

    def test_after_accept_each_side_gets_the_others_details_and_only_them(self, client, setup, request_food, make_user, admin):
        d, item, r1, r2 = setup
        rid = request_food(r1, item["id"], 2).json()["request"]["id"]
        request_food(r2, item["id"], 1)    # a second, unrelated recipient on the same listing
        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"})
        seen_by_recipient = client.get(f"/api/requests/{rid}", headers=r1.h).json()["request"]
        assert seen_by_recipient["donor"]["phone"] == "0770000001"
        assert seen_by_recipient["donor"]["email"] == d.email
        assert seen_by_recipient["donor"]["address"] == "12 Secret Lane, Pettah"
        seen_by_donor = client.get(f"/api/requests/{rid}", headers=d.h).json()["request"]
        assert seen_by_donor["recipient"]["email"] == r1.email
        # the listing detail shows the contact block to the accepted recipient...
        mine = client.get(f"/api/listings/{item['id']}", headers=r1.h).json()["listing"]
        assert mine["contact"]["phone"] == "0770000001" and mine["contact"]["address"] == "12 Secret Lane, Pettah"
        # ...and still to nobody else (the other recipient's request is still pending)
        for who in (r2, make_user("recipient")):
            theirs = client.get(f"/api/listings/{item['id']}", headers=who.h).json()["listing"]
            assert "contact" not in theirs and "pickup_address" not in theirs
        assert "Secret Lane" not in client.get(f"/api/listings/{item['id']}").text
        # the donor's list of requests does not leak the accepted recipient to the pending one either
        other = client.get("/api/requests", headers=r2.h).json()["requests"]
        assert all(r["id"] != rid for r in other)

    def test_a_declined_recipient_never_gets_contact_details(self, client, setup, request_food):
        d, item, r1, _ = setup
        rid = request_food(r1, item["id"], 2).json()["request"]["id"]
        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "declined", "reason": "No"})
        req = client.get(f"/api/requests/{rid}", headers=r1.h).json()["request"]
        assert self._contact_fields(req) == {}
        assert "contact" not in client.get(f"/api/listings/{item['id']}", headers=r1.h).json()["listing"]

    def test_admin_listing_of_requests_carries_no_contact_details(self, client, setup, request_food, admin):
        d, item, r1, _ = setup
        rid = request_food(r1, item["id"], 2).json()["request"]["id"]
        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"})
        row = next(x for x in client.get("/api/requests", headers=admin.h).json()["requests"] if x["id"] == rid)
        assert self._contact_fields(row) == {}


class TestHandoverStatuses:
    def test_happy_path_and_who_can_do_what(self, client, setup, request_food):
        d, item, r1, r2 = setup
        rid = request_food(r1, item["id"], 2).json()["request"]["id"]
        put = lambda who, st: client.put(f"/api/requests/{rid}/status", headers=who.h, json={"status": st})  # noqa: E731
        assert put(d, "collected").status_code == 400            # still pending: must be accepted first
        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"})
        assert put(r2, "collected").status_code == 404            # a stranger
        assert put(r1, "no_show").status_code == 403              # only the donor reports a no-show
        assert put(r1, "completed").status_code == 400            # recipient can complete only after collected
        assert put(r1, "collected").status_code == 200
        assert put(r1, "completed").status_code == 200
        assert put(d, "cancelled").status_code == 400             # terminal
        got = client.get(f"/api/requests/{rid}", headers=d.h).json()["request"]
        assert got["status"] == "completed" and got["completed_at"] and got["collected_at"]

    def test_donor_can_complete_straight_from_accepted(self, client, setup, request_food):
        d, item, r1, _ = setup
        rid = request_food(r1, item["id"], 2).json()["request"]["id"]
        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"})
        assert client.put(f"/api/requests/{rid}/status", headers=d.h, json={"status": "completed"}).status_code == 200

    def test_unknown_status_is_rejected(self, client, setup, request_food):
        d, item, r1, _ = setup
        rid = request_food(r1, item["id"], 2).json()["request"]["id"]
        assert client.put(f"/api/requests/{rid}/status", headers=d.h, json={"status": "delivered"}).status_code == 400


class TestNotifications:
    def test_each_step_notifies_the_other_side_in_app_and_by_email(self, client, setup, request_food, outbox):
        d, item, r1, _ = setup
        rid = request_food(r1, item["id"], 2, "please").json()["request"]["id"]
        donor_bell = client.get("/api/notifications", headers=d.h).json()
        assert any(n["kind"] == "request_received" for n in donor_bell["notifications"])
        assert any(m["to"] == d.email and "requested your food" in m["subject"] for m in outbox)

        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"})
        rec_bell = client.get("/api/notifications", headers=r1.h).json()
        assert any(n["kind"] == "request_accepted" for n in rec_bell["notifications"])
        mail = next(m for m in outbox if m["to"] == r1.email and "accepted" in m["subject"].lower())
        assert "0770000001" in mail["html"] and "12 Secret Lane" in mail["html"]   # contact goes in the email too

    def test_declined_email_carries_the_reason(self, client, setup, request_food, outbox):
        d, item, r1, _ = setup
        rid = request_food(r1, item["id"], 2).json()["request"]["id"]
        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "declined", "reason": "Gave it to a shelter"})
        assert any(m["to"] == r1.email and "Gave it to a shelter" in m["html"] for m in outbox)

    def test_email_off_still_gets_the_bell(self, client, setup, request_food, make_user, outbox, post_listing):
        d = make_user("donor", notify_email=False)
        item = post_listing(d)
        request_food(setup[2], item["id"], 1)
        assert not any(m["to"] == d.email for m in outbox)
        assert client.get("/api/notifications", headers=d.h).json()["unread"] >= 1


class TestConcurrency:
    def test_parallel_requests_never_oversell(self, client, make_user, post_listing, request_food, db):
        d = make_user("donor")
        item = post_listing(d, quantity_total="10")
        people = [make_user("recipient") for _ in range(8)]
        results = []

        def go(p):
            results.append(request_food(p, item["id"], 3).status_code)

        threads = [threading.Thread(target=go, args=(p,)) for p in people]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert sorted(results).count(200) == 3, results       # 3 x 3 = 9 of 10, a fourth would need 12
        assert avail(db, item["id"]) == 1
        assert set(results) <= {200, 400}

    def test_parallel_accept_and_cancel_keep_the_books_balanced(self, client, setup, request_food, db):
        d, item, r1, _ = setup
        rid = request_food(r1, item["id"], 5).json()["request"]["id"]
        out = []

        def accept():
            out.append(client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"}).status_code)

        def cancel():
            out.append(client.put(f"/api/requests/{rid}/status", headers=r1.h, json={"status": "cancelled"}).status_code)

        ts = [threading.Thread(target=accept), threading.Thread(target=cancel)]
        for t in ts:
            t.start()
        for t in ts:
            t.join()
        final = client.get(f"/api/requests/{rid}", headers=r1.h).json()["request"]["status"]
        assert final in ("accepted", "cancelled")
        assert avail(db, item["id"]) == (5 if final == "accepted" else 10)
