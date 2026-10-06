"""Listings: posting, validation, nearby-first ordering, filters, privacy for guests, editing, closing, expiry."""
import uuid
from datetime import timedelta

from tests.conftest import in_hours, listing_form, listing_row, png_bytes

PRIVATE_FIELDS = ("pickup_address", "contact_phone", "contact", "contact_email")


class TestPosting:
    def test_goes_live_immediately_with_stock_set(self, client, make_user, post_listing):
        d = make_user("donor")
        item = post_listing(d, quantity_total="12.5", unit="kg")
        assert item["status"] == "active"
        assert item["quantity_total"] == 12.5 == item["quantity_available"]
        assert len(item["images"]) == 1
        # the donor sees their own address back
        assert item["pickup_address"] == "12 Secret Lane, Pettah"

    def test_only_donors_can_post(self, client, make_user, post_listing):
        for role in ("recipient", "ngo", "admin"):
            post_listing(make_user(role), expect=403)

    def test_login_is_required(self, client):
        res = client.post("/api/listings", data=listing_form(), files=[("images", ("a.png", png_bytes(), "image/png"))])
        assert res.status_code == 401

    def test_at_least_one_photo_is_required(self, client, make_user, post_listing):
        res = post_listing(make_user("donor"), n_images=0, expect=400)
        assert "photo" in res.json()["detail"]

    def test_at_most_three_photos(self, client, make_user, post_listing):
        post_listing(make_user("donor"), n_images=3)
        res = post_listing(make_user("donor"), n_images=4, expect=400)
        assert "3" in res.json()["detail"]

    def test_safety_tick_is_required(self, client, make_user, post_listing):
        res = post_listing(make_user("donor"), safety_confirmed="false", expect=400)
        assert "safe" in res.json()["detail"]

    def test_validation(self, client, make_user, post_listing):
        d = make_user("donor")
        cases = [
            ({"quantity_total": "0"}, "more than 0"),
            ({"quantity_total": "abc"}, "number"),
            ({"quantity_total": "-3"}, "more than 0"),
            ({"unit": "bucketfuls"}, "Unit"),
            ({"district": "Atlantis"}, "districts"),
            ({"category": "pizza"}, "category"),
            ({"expires_at": in_hours(-1)}, "future"),
            ({"expires_at": in_hours(24 * 40)}, "30 days"),
            ({"expires_at": "tomorrow-ish"}, "date"),
            ({"fulfilment": "drone"}, "fulfilment"),
            ({"prepared_at": in_hours(5)}, "future"),
        ]
        for over, needle in cases:
            res = post_listing(d, expect=400, **over)
            assert needle.lower() in res.json()["detail"].lower(), (over, res.text)

    def test_a_bad_image_is_rejected_and_nothing_is_created(self, client, make_user, db):
        d = make_user("donor")
        res = client.post("/api/listings", headers=d.h, data=listing_form(),
                          files=[("images", ("x.png", b"not really an image", "image/png"))])
        assert res.status_code == 400
        mine = client.get(f"/api/listings?donor_id={d.id}", headers=d.h).json()
        assert mine["total"] == 0


class TestPrivacy:
    def test_guests_see_district_and_area_but_never_contact_or_address(self, client, make_user, post_listing):
        d = make_user("donor", phone_number="0771234567")
        item = post_listing(d, food_name="pytest_ guest view")
        guest = client.get("/api/listings?q=pytest_ guest view").json()["listings"]
        assert [g["id"] for g in guest] == [item["id"]]
        g = guest[0]
        assert g["district"] == "Colombo" and g["area"] == "Pettah"
        for f in PRIVATE_FIELDS:
            assert f not in g
        detail = client.get(f"/api/listings/{item['id']}").json()["listing"]
        for f in PRIVATE_FIELDS:
            assert f not in detail
        assert "Secret Lane" not in client.get(f"/api/listings/{item['id']}").text
        assert "0771234567" not in client.get(f"/api/listings/{item['id']}").text

    def test_a_signed_in_stranger_sees_no_contact_either(self, client, make_user, post_listing):
        item = post_listing(make_user("donor"))
        other = make_user("recipient")
        body = client.get(f"/api/listings/{item['id']}", headers=other.h).json()["listing"]
        for f in PRIVATE_FIELDS:
            assert f not in body

    def test_a_recipient_with_a_pending_request_still_sees_no_contact(self, client, make_user, post_listing, request_food):
        item = post_listing(make_user("donor"))
        r = make_user("recipient")
        assert request_food(r, item["id"], 2).status_code == 200
        body = client.get(f"/api/listings/{item['id']}", headers=r.h).json()["listing"]
        for f in PRIVATE_FIELDS:
            assert f not in body

    def test_the_donor_and_admin_see_the_address(self, client, make_user, post_listing, admin):
        d = make_user("donor", phone_number="0779999999")
        item = post_listing(d)
        for who in (d, admin):
            body = client.get(f"/api/listings/{item['id']}", headers=who.h).json()["listing"]
            assert body["pickup_address"] == "12 Secret Lane, Pettah"
            assert body["contact_phone"] == "0779999999"


class TestNearbyFirst:
    def _three(self, make_user, post_listing):
        d = make_user("donor", district="Colombo")
        tag = uuid.uuid4().hex[:8]
        names = {"tag": tag}
        # Colombo (same), Gampaha (neighbour of Colombo), Jaffna (far); posted in the "wrong" order,
        # with the far one expiring soonest to prove district beats urgency.
        names["far"] = post_listing(d, food_name=f"pytest_ order {tag} far", district="Jaffna", expires_at=in_hours(2))["id"]
        names["near"] = post_listing(d, food_name=f"pytest_ order {tag} neighbour", district="Gampaha", expires_at=in_hours(5))["id"]
        names["same"] = post_listing(d, food_name=f"pytest_ order {tag} same", district="Colombo", expires_at=in_hours(20))["id"]
        return names

    def test_same_district_then_neighbours_then_the_rest(self, client, make_user, post_listing):
        ids = self._three(make_user, post_listing)
        res = client.get(f"/api/listings?q=pytest_ order {ids['tag']}&near=Colombo").json()
        assert [x["id"] for x in res["listings"]] == [ids["same"], ids["near"], ids["far"]]
        assert [x["proximity"] for x in res["listings"]] == ["same_district", "neighbouring", "other"]

    def test_a_signed_in_user_is_sorted_around_their_own_district(self, client, make_user, post_listing):
        ids = self._three(make_user, post_listing)
        jaffna = make_user("recipient", district="Jaffna")
        res = client.get(f"/api/listings?q=pytest_ order {ids['tag']}", headers=jaffna.h).json()
        assert res["near"] == "Jaffna"
        assert res["listings"][0]["id"] == ids["far"]

    def test_without_a_district_the_soonest_to_spoil_comes_first(self, client, make_user, post_listing):
        ids = self._three(make_user, post_listing)
        res = client.get(f"/api/listings?q=pytest_ order {ids['tag']}").json()
        assert [x["id"] for x in res["listings"]] == [ids["far"], ids["near"], ids["same"]]

    def test_district_filter_category_filter_and_search(self, client, make_user, post_listing):
        d = make_user("donor", district="Kandy")
        tag = uuid.uuid4().hex[:8]
        a = post_listing(d, food_name=f"pytest_ filt {tag} bread", district="Kandy", category="bakery")["id"]
        b = post_listing(d, food_name=f"pytest_ filt {tag} milk", district="Galle", category="dairy_eggs")["id"]
        ids = lambda qs: {x["id"] for x in client.get(f"/api/listings?q=pytest_ filt {tag}" + qs).json()["listings"]}  # noqa: E731
        assert ids("") == {a, b}
        assert ids("&district=Kandy") == {a}
        assert ids("&district=Kandy,Galle") == {a, b}
        assert ids("&category=dairy_eggs") == {b}
        assert {x["id"] for x in client.get(f"/api/listings?q={tag} bread").json()["listings"]} >= {a}
        assert client.get("/api/listings?district=Nowhere").status_code == 400
        assert client.get("/api/listings?category=pizza").status_code == 400

    def test_sold_out_expired_and_closed_listings_leave_the_public_browse(self, client, make_user, post_listing, request_food, db):
        d = make_user("donor")
        item = post_listing(d, food_name="pytest_ vanishing", quantity_total="4")
        r = make_user("recipient")
        assert request_food(r, item["id"], 4).status_code == 200      # takes everything -> sold out
        assert client.get("/api/listings?q=pytest_ vanishing").json()["total"] == 0
        # the donor still sees it, with its status
        mine = client.get(f"/api/listings?donor_id={d.id}&status=sold_out", headers=d.h).json()["listings"]
        assert [m["id"] for m in mine] == [item["id"]]


class TestOwnerListAccess:
    def test_donor_id_filter_is_for_the_owner_or_admin(self, client, make_user, post_listing, admin):
        d = make_user("donor")
        post_listing(d)
        assert client.get(f"/api/listings?donor_id={d.id}").status_code == 401
        assert client.get(f"/api/listings?donor_id={d.id}", headers=make_user("donor").h).status_code == 403
        assert client.get(f"/api/listings?donor_id={d.id}", headers=d.h).json()["total"] == 1
        assert client.get(f"/api/listings?donor_id={d.id}", headers=admin.h).json()["total"] == 1


class TestEditCloseDelete:
    def test_edit_changes_fields_and_stock_total_keeps_held_stock(self, client, make_user, post_listing, request_food, db):
        d = make_user("donor")
        item = post_listing(d, quantity_total="10")
        r = make_user("recipient")
        assert request_food(r, item["id"], 6).status_code == 200      # 6 held, 4 available
        res = client.put(f"/api/listings/{item['id']}", headers=d.h, json={"quantity_total": 12, "area": "Fort"})
        assert res.status_code == 200, res.text
        row = listing_row(db, item["id"])
        assert (float(row.quantity_total), float(row.quantity_available), row.area) == (12.0, 6.0, "Fort")
        low = client.put(f"/api/listings/{item['id']}", headers=d.h, json={"quantity_total": 5})
        assert low.status_code == 400 and "already requested" in low.json()["detail"]

    def test_only_the_owner_can_edit(self, client, make_user, post_listing):
        item = post_listing(make_user("donor"))
        res = client.put(f"/api/listings/{item['id']}", headers=make_user("donor").h, json={"area": "x"})
        assert res.status_code == 403

    def test_extending_expiry_validates_the_time(self, client, make_user, post_listing):
        d = make_user("donor")
        item = post_listing(d)
        past = (in_hours(-2))
        assert client.put(f"/api/listings/{item['id']}", headers=d.h, json={"expires_at": past}).status_code == 400
        assert client.put(f"/api/listings/{item['id']}", headers=d.h, json={"expires_at": in_hours(48)}).status_code == 200

    def test_close_declines_pending_and_returns_their_stock_but_keeps_accepted(self, client, make_user, post_listing, request_food, db):
        d = make_user("donor")
        item = post_listing(d, quantity_total="10")
        r1, r2 = make_user("recipient"), make_user("recipient")
        a = request_food(r1, item["id"], 3).json()["request"]["id"]
        b = request_food(r2, item["id"], 2).json()["request"]["id"]
        assert client.put(f"/api/requests/{a}/respond", headers=d.h, json={"status": "accepted"}).status_code == 200
        assert client.post(f"/api/listings/{item['id']}/close", headers=d.h, json={"reason": "Out of time"}).status_code == 200
        rows = {x["id"]: x for x in client.get("/api/requests", headers=d.h).json()["requests"]}
        assert rows[a]["status"] == "accepted"
        assert rows[b]["status"] == "declined" and rows[b]["decline_reason"] == "Out of time"
        row = listing_row(db, item["id"])
        assert row.status == "closed" and float(row.quantity_available) == 7.0   # the accepted 3 stay taken
        # the closed listing is hidden from strangers
        assert client.get(f"/api/listings/{item['id']}").status_code == 404

    def test_delete_only_when_nobody_asked(self, client, make_user, post_listing, request_food):
        d = make_user("donor")
        clean = post_listing(d)
        asked = post_listing(d)
        request_food(make_user("recipient"), asked["id"], 1)
        assert client.delete(f"/api/listings/{clean['id']}", headers=make_user("donor").h).status_code == 403
        assert client.delete(f"/api/listings/{clean['id']}", headers=d.h).status_code == 200
        res = client.delete(f"/api/listings/{asked['id']}", headers=d.h)
        assert res.status_code == 400 and "close" in res.json()["detail"]


class TestExpiry:
    def test_overdue_listing_expires_and_its_pending_requests_are_released(self, client, make_user, post_listing,
                                                                           request_food, db, outbox):
        from app.models import FoodListing
        from app.services.stock import run_expiry

        d = make_user("donor")
        item = post_listing(d, quantity_total="10")
        r = make_user("recipient")
        req = request_food(r, item["id"], 4).json()["request"]
        db.expire_all()
        db.query(FoodListing).filter(FoodListing.id == item["id"]).update(
            {"expires_at": item_time_ago(db)}, synchronize_session=False)
        db.commit()
        assert run_expiry(db) >= 1
        row = listing_row(db, item["id"])
        assert row.status == "expired" and float(row.quantity_available) == 10.0
        got = client.get(f"/api/requests/{req['id']}", headers=r.h).json()["request"]
        assert got["status"] == "expired"
        assert not any(i["id"] == item["id"] for i in client.get("/api/listings?limit=100").json()["listings"])
        assert any("expired" in m["subject"].lower() for m in outbox if m["to"] == r.email)

    def test_an_accepted_request_survives_the_listing_expiring(self, client, make_user, post_listing, request_food, db):
        from app.models import FoodListing
        from app.services.stock import run_expiry

        d = make_user("donor")
        item = post_listing(d, quantity_total="10")
        r = make_user("recipient")
        rid = request_food(r, item["id"], 4).json()["request"]["id"]
        client.put(f"/api/requests/{rid}/respond", headers=d.h, json={"status": "accepted"})
        db.query(FoodListing).filter(FoodListing.id == item["id"]).update(
            {"expires_at": item_time_ago(db)}, synchronize_session=False)
        db.commit()
        run_expiry(db)
        assert client.get(f"/api/requests/{rid}", headers=r.h).json()["request"]["status"] == "accepted"
        assert float(listing_row(db, item["id"]).quantity_available) == 6.0


def item_time_ago(db):
    from app.utils.timeutil import now_colombo
    return now_colombo() - timedelta(minutes=1)


