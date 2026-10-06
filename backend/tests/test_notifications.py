"""Bell + email notifications: who is told about a new listing, preferences, and the bell endpoints."""
def bell(client, who, kind=None):
    rows = client.get("/api/notifications", headers=who.h).json()["notifications"]
    return [n for n in rows if kind is None or n["kind"] == kind]


class TestNewListingMatching:
    def test_notifies_by_district_neighbours_and_chosen_districts(self, client, make_user, post_listing, outbox):
        donor = make_user("donor", district="Kandy")
        same = make_user("recipient", district="Kandy")
        neighbour = make_user("recipient", district="Matale")            # borders Kandy
        far = make_user("recipient", district="Jaffna")
        asked = make_user("recipient", district="Jaffna", notify_districts=["Kandy"])
        only_matale = make_user("recipient", district="Kandy", notify_districts=["Matale"])   # chose elsewhere
        nowhere = make_user("recipient", district=None)                    # no district, no preference -> everything
        item = post_listing(donor, district="Kandy", category="bakery")
        for who in (same, neighbour, asked, nowhere):
            assert bell(client, who, "new_listing"), who.user.district
        for who in (far, only_matale, donor):
            assert not bell(client, who, "new_listing")
        note = bell(client, same, "new_listing")[0]
        assert note["link"] == f"/listings/{item['id']}" and "Kandy" in note["body"]
        mailed = {m["to"] for m in outbox if "New food near you" in m["subject"]}
        assert {same.email, neighbour.email, asked.email} <= mailed and far.email not in mailed

    def test_food_type_preference_filters(self, client, make_user, post_listing):
        donor = make_user("donor", district="Galle")
        wants_bread = make_user("recipient", district="Galle", notify_food_types=["bakery"])
        wants_dairy = make_user("recipient", district="Galle", notify_food_types=["dairy_eggs"])
        anything = make_user("recipient", district="Galle")
        post_listing(donor, district="Galle", category="bakery")
        assert bell(client, wants_bread, "new_listing") and bell(client, anything, "new_listing")
        assert not bell(client, wants_dairy, "new_listing")

    def test_email_off_means_bell_only(self, client, make_user, post_listing, outbox):
        quiet = make_user("recipient", district="Galle", notify_email=False)
        post_listing(make_user("donor", district="Galle"), district="Galle")
        assert bell(client, quiet, "new_listing")
        assert not any(m["to"] == quiet.email for m in outbox)

    def test_only_active_receivers_are_told(self, client, make_user, post_listing):
        suspended = make_user("recipient", district="Galle", status="suspended")
        pending_ngo = make_user("ngo", district="Galle", ngo_status="pending")
        approved_ngo = make_user("ngo", district="Galle")
        other_donor = make_user("donor", district="Galle")
        post_listing(make_user("donor", district="Galle"), district="Galle")
        assert bell(client, approved_ngo, "new_listing")
        for who in (suspended, pending_ngo, other_donor):
            assert not [n for n in _rows(who) if n.kind == "new_listing"]


def _rows(who):
    from app.database import SessionLocal
    from app.models import Notification
    s = SessionLocal()
    try:
        return s.query(Notification).filter(Notification.user_id == who.id).all()
    finally:
        s.close()


class TestPreferences:
    def test_save_and_read_back(self, client, make_user):
        u = make_user("recipient")
        res = client.put("/api/auth/me", headers=u.h, json={
            "name": "Pytest Prefs", "district": "Galle", "notify_districts": ["Matara", "Galle", "Galle"],
            "notify_food_types": ["bakery", "dairy_eggs"], "notify_email": False})
        assert res.status_code == 200, res.text
        got = client.get("/api/auth/me", headers=u.h).json()["user"]
        assert got["district"] == "Galle" and got["notify_districts"] == ["Galle", "Matara"]
        assert got["notify_food_types"] == ["bakery", "dairy_eggs"] and got["notify_email"] is False

    def test_bad_values_are_rejected(self, client, make_user):
        u = make_user("recipient")
        for over in ({"district": "Atlantis"}, {"notify_districts": ["Atlantis"]}, {"notify_food_types": ["pizza"]}):
            res = client.put("/api/auth/me", headers=u.h, json={"name": "Pytest Prefs", **over})
            assert res.status_code == 422, over

    def test_a_profile_save_without_prefs_keeps_the_old_ones(self, client, make_user):
        u = make_user("recipient", notify_districts=["Galle"], notify_food_types=["bakery"])
        client.put("/api/auth/me", headers=u.h, json={"name": "Pytest Same"})
        got = client.get("/api/auth/me", headers=u.h).json()["user"]
        assert got["notify_districts"] == ["Galle"] and got["notify_food_types"] == ["bakery"]


class TestBellEndpoints:
    def test_unread_count_read_one_read_all_and_privacy(self, client, make_user, post_listing, request_food):
        d, r = make_user("donor"), make_user("recipient")
        item = post_listing(d)
        for _ in range(2):
            request_food(make_user("recipient"), item["id"], 1)
        assert client.get("/api/notifications/unread-count", headers=d.h).json()["unread"] >= 2
        first = bell(client, d)[0]
        assert client.post(f"/api/notifications/{first['id']}/read", headers=r.h).status_code == 404   # not theirs
        assert client.delete(f"/api/notifications/{first['id']}", headers=r.h).status_code == 404
        assert client.post(f"/api/notifications/{first['id']}/read", headers=d.h).status_code == 200
        before = client.get("/api/notifications/unread-count", headers=d.h).json()["unread"]
        assert client.post("/api/notifications/read-all", headers=d.h).status_code == 200
        assert before >= 1
        assert client.get("/api/notifications/unread-count", headers=d.h).json()["unread"] == 0
        assert client.get("/api/notifications?unread_only=true", headers=d.h).json()["notifications"] == []
        assert client.get("/api/notifications").status_code == 401

    def test_each_user_sees_only_their_own(self, client, make_user, post_listing, request_food):
        d = make_user("donor")
        item = post_listing(d)
        request_food(make_user("recipient"), item["id"], 1)
        stranger = make_user("donor")
        assert not bell(client, stranger, "request_received")
