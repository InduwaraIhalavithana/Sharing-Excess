"""Profile photos: every role except the admin can set, replace and remove one."""
import io
from pathlib import Path

from app.utils.uploads import UPLOAD_DIR

from .conftest import png_bytes


def upload(client, who, data=None, name="me.png", mime="image/png"):
    return client.post("/api/auth/me/photo", headers=who.h, files={"photo": (name, io.BytesIO(data or png_bytes()), mime)})


class TestProfilePhoto:
    def test_a_donor_and_a_recipient_can_set_and_remove_a_photo(self, client, make_user):
        for role in ("donor", "recipient"):
            who = make_user(role)
            res = upload(client, who)
            assert res.status_code == 200, res.text
            url = res.json()["user"]["photo"]
            assert url and client.get("/api/auth/me", headers=who.h).json()["user"]["photo"] == url
            assert (Path(UPLOAD_DIR) / url.rsplit("/", 1)[-1]).exists()
            gone = client.delete("/api/auth/me/photo", headers=who.h)
            assert gone.json()["user"]["photo"] is None
            assert not (Path(UPLOAD_DIR) / url.rsplit("/", 1)[-1]).exists()

    def test_replacing_a_photo_deletes_the_old_file(self, client, make_user):
        who = make_user("donor")
        first = upload(client, who).json()["user"]["photo"]
        second = upload(client, who).json()["user"]["photo"]
        assert first != second
        assert not (Path(UPLOAD_DIR) / first.rsplit("/", 1)[-1]).exists()

    def test_an_ngo_photo_is_its_logo(self, client, make_user):
        ngo = make_user("ngo")
        user = upload(client, ngo).json()["user"]
        assert user["photo"] == user["org_logo"] and user["photo"]
        card = next(n for n in client.get("/api/ngos?q=Pytest Org").json()["ngos"] if n["id"] == ngo.id)
        assert card["logo"] == user["photo"]

    def test_the_photo_shows_on_listings_requests_and_profiles(self, client, make_user, post_listing, request_food):
        donor, recipient = make_user("donor"), make_user("recipient")
        upload(client, donor)
        upload(client, recipient)
        listing = post_listing(donor)
        assert client.get(f"/api/listings/{listing['id']}").json()["listing"]["donor_photo"]
        req = request_food(recipient, listing["id"], 1)
        mine = client.get("/api/requests", headers=recipient.h).json()["requests"]
        row = next(r for r in mine if r["id"] == req.json()["request"]["id"])
        assert row["donor"]["photo"] and row["recipient"]["photo"]
        assert client.get(f"/api/ratings/user/{donor.id}").json()["user"]["photo"]

    def test_bad_files_and_the_admin_are_refused(self, client, make_user, admin):
        who = make_user("donor")
        assert upload(client, who, data=b"not an image at all", name="x.png").status_code == 400
        assert upload(client, who, data=png_bytes(), name="x.exe", mime="application/octet-stream").status_code == 400
        assert upload(client, who, data=b"x" * (5 * 1024 * 1024 + 1)).status_code == 400
        assert upload(client, admin).status_code == 403
        assert client.post("/api/auth/me/photo", files={"photo": ("a.png", io.BytesIO(png_bytes()), "image/png")}).status_code in (401, 403)

    def test_deleting_the_account_removes_the_photo_file(self, client, make_user):
        who = make_user("recipient", password=__import__("app.utils.security", fromlist=["x"]).hash_password("testpass123"))
        url = upload(client, who).json()["user"]["photo"]
        res = client.request("DELETE", "/api/auth/me", headers=who.h, json={"password": "testpass123"})
        assert res.status_code == 200, res.text
        assert not (Path(UPLOAD_DIR) / url.rsplit("/", 1)[-1]).exists()
