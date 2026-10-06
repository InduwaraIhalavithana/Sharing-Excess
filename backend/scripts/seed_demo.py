"""Fill the database with clearly-labelled demo data so every page has something to show.

    python -m scripts.seed_demo --yes      # (re)create the demo data
    python -m scripts.seed_demo --remove   # delete only the demo data

Safe by design:
  * every demo account uses the @demo.sharingexcess.lk domain, which is how --remove finds them
  * running it twice does not duplicate anything (old demo rows are replaced)
  * real accounts and their data are never touched
  * demo accounts have no usable password and cannot log in
Back up first if the database holds anything you care about (pg_dump).
"""
import argparse
import secrets
import sys
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import text

from app.database import SessionLocal, engine
from app.models import (
    CommunityEvent,
    Feedback,
    FoodListing,
    FoodRequest,
    Notification,
    Rating,
    Report,
    User,
)
from app.services.accounts import purge_user
from app.utils.timeutil import now_colombo

DOMAIN = "@demo.sharingexcess.lk"


def ago(days: float = 0, hours: float = 0) -> datetime:
    return now_colombo() - timedelta(days=days, hours=hours)


def ahead(hours: float) -> datetime:
    return now_colombo() + timedelta(hours=hours)


# name, slug, phone, district, town
DONORS = [
    ("Lanka Bakers", "lanka-bakers", "0112 445 210", "Colombo", "Pettah"),
    ("Hill Country Hotel", "hill-country-hotel", "0522 222 345", "Nuwara Eliya", "Nuwara Eliya"),
    ("Seaside Restaurant", "seaside-restaurant", "0912 224 118", "Galle", "Galle Fort"),
    ("Kandy Lake Catering", "kandy-lake-catering", "0812 233 907", "Kandy", "Kandy"),
    ("Green Valley Farm", "green-valley-farm", "0552 223 640", "Badulla", "Bandarawela"),
    ("Northern Sweets", "northern-sweets", "0212 221 506", "Jaffna", "Jaffna"),
    ("Negombo Fish Market Co-op", "negombo-coop", "0312 222 871", "Gampaha", "Negombo"),
    ("Harbour View Hotel", "harbour-view-hotel", "0472 223 005", "Matara", "Matara"),
]

RECIPIENTS = [
    ("Sunrise Children's Home", "sunrise-childrens-home", "0112 887 410", "Colombo"),
    ("Hope Elders' Care", "hope-elders-care", "0812 410 223", "Kandy"),
    ("Galle Community Kitchen", "galle-community-kitchen", "0912 245 667", "Galle"),
    ("Badulla Youth Shelter", "badulla-youth-shelter", "0552 230 118", "Badulla"),
    ("Jaffna Family Support", "jaffna-family-support", "0212 227 340", "Jaffna"),
    ("Anuradhapura Women's Circle", "anuradhapura-womens-circle", "0252 221 905", "Anuradhapura"),
]

# slug, name, description, district, approved?
NGOS = [
    ("lanka-meals", "Lanka Meals Collective", "A volunteer-run kitchen turning donated ingredients into hot meals for city families.", "Colombo", "approved"),
    ("hill-food-bank", "Hill Country Food Bank", "Collects surplus vegetables from highland farms and shares them with estate communities.", "Nuwara Eliya", "approved"),
    ("ruhuna-table", "Ruhuna Community Table", "A weekly shared lunch, plus packed meals for elderly neighbours.", "Matara", "approved"),
    ("new-hope", "New Hope Trust", "Recently registered, waiting for approval.", "Kurunegala", "pending"),
]

# donor slug, food, category, total, unit, available-after-requests handled below, hours until expiry, district, area, description, fulfilment, status
LISTINGS = [
    ("lanka-bakers", "Fresh bread loaves", "bakery", 40, "loaves", 20, "Colombo", "Pettah", "Baked this morning, unsold at closing. Sliced and bagged.", "both"),
    ("lanka-bakers", "Assorted buns and rolls", "bakery", 60, "pieces", 14, "Colombo", "Fort", "Fish buns, egg rolls and plain buns.", "pickup"),
    ("hill-country-hotel", "Vegetable curry and rice", "cooked_meals", 30, "meals", 5, "Nuwara Eliya", "Nuwara Eliya", "Buffet surplus from a wedding lunch, packed in containers.", "pickup"),
    ("seaside-restaurant", "Cooked rice and dhal", "cooked_meals", 25, "packets", 6, "Galle", "Galle Fort", "Packed lunch portions, ready to collect before 6 pm.", "both"),
    ("kandy-lake-catering", "Fruit platter leftovers", "vegetables_fruits", 12, "kg", 48, "Kandy", "Kandy", "Pineapple, papaya and watermelon from a conference.", "pickup"),
    ("green-valley-farm", "Carrots and leeks", "vegetables_fruits", 50, "kg", 96, "Badulla", "Bandarawela", "Slightly misshapen, perfectly good. Farm gate pickup.", "pickup"),
    ("green-valley-farm", "Cabbage", "vegetables_fruits", 80, "kg", 120, "Badulla", "Welimada", "Fresh harvest, surplus after the weekly fair.", "both"),
    ("northern-sweets", "Milk toffee and sweets", "packaged", 15, "boxes", 480, "Jaffna", "Jaffna", "Sealed boxes, long shelf life.", "pickup"),
    ("negombo-coop", "Dried fish", "packaged", 30, "kg", 700, "Gampaha", "Negombo", "Salted and dried, packed in 1 kg bags.", "delivery"),
    ("harbour-view-hotel", "Breakfast pastries", "bakery", 45, "pieces", 20, "Matara", "Matara", "Croissants and sweet buns from the morning buffet.", "pickup"),
    ("kandy-lake-catering", "Packed dinner boxes", "cooked_meals", 20, "boxes", 4, "Kandy", "Peradeniya", "Event cancelled at short notice, all food fresh.", "both"),
]

DESCRIPTION_FEEDBACK = [
    ("sunrise-childrens-home", 5, "The bread arrived warm and the children had a proper breakfast. Thank you!"),
    ("hope-elders-care", 4, "Gentle, well-packed food for our elders. Pickup instructions could be a little clearer."),
]


def remove(db) -> int:
    users = db.query(User).filter(User.email.like(f"%{DOMAIN}")).all()
    for u in users:
        purge_user(db, u)
    db.query(Report).filter(Report.reporter_id.is_(None), Report.reason.like("[demo]%")).delete(synchronize_session=False)
    db.commit()
    return len(users)


def seed(db) -> dict:
    from app.utils.security import hash_password

    unusable = hash_password(secrets.token_urlsafe(32))  # nobody knows it: demo accounts cannot sign in
    donors, recipients, ngos = {}, {}, {}
    for name, slug, phone, district, town in DONORS:
        u = User(name=name, email=f"{slug}{DOMAIN}", password=unusable, role="donor", status="active", phone_number=phone,
                 location=town, district=district, created_at=ago(40))
        db.add(u)
        donors[slug] = u
    for name, slug, phone, district in RECIPIENTS:
        u = User(name=name, email=f"{slug}{DOMAIN}", password=unusable, role="recipient", status="active", phone_number=phone,
                 location=district, district=district, created_at=ago(35))
        db.add(u)
        recipients[slug] = u
    for slug, name, desc, district, status in NGOS:
        u = User(name=f"{name} (contact)", email=f"{slug}{DOMAIN}", password=unusable, role="ngo", status="active",
                 phone_number="0112 000 000", district=district, org_name=name, org_description=desc, ngo_status=status,
                 created_at=ago(30))
        db.add(u)
        ngos[slug] = u
    db.flush()

    listings = {}
    for i, (slug, food, cat, total, unit, hours, district, area, desc, fulfil) in enumerate(LISTINGS):
        donor = donors[slug]
        row = FoodListing(
            donor_id=donor.id, food_name=food, description=desc, category=cat, quantity_total=Decimal(total),
            quantity_available=Decimal(total), unit=unit, district=district, area=area, pickup_address=f"{area} (demo address)",
            contact_phone=donor.phone_number, expires_at=ahead(hours), fulfilment=fulfil, images=[], safety_confirmed=True,
            status="active", created_at=ago(0, i * 2),
        )
        db.add(row)
        listings[food] = row
    db.flush()

    def request(recipient, listing, qty, status, message=None, reason=None, age=1):
        r = FoodRequest(recipient_id=recipient.id, listing_id=listing.id, quantity_requested=Decimal(qty), status=status,
                        message=message, decline_reason=reason, created_at=ago(age))
        if status != "pending":
            r.responded_at = ago(age, -1)
        if status in ("collected", "completed"):
            r.collected_at = ago(age, -2)
        if status == "completed":
            r.completed_at = ago(age, -3)
        db.add(r)
        if status in ("pending", "accepted", "collected", "completed"):
            listing.quantity_available -= Decimal(qty)
        return r

    bread, curry, dhal = listings["Fresh bread loaves"], listings["Vegetable curry and rice"], listings["Cooked rice and dhal"]
    fruit, carrots = listings["Fruit platter leftovers"], listings["Carrots and leeks"]
    sunrise, hope, galle = recipients["sunrise-childrens-home"], recipients["hope-elders-care"], recipients["galle-community-kitchen"]
    done_a = request(sunrise, bread, 10, "completed", "Breakfast for 40 children", age=4)
    done_b = request(hope, fruit, 4, "completed", age=6)
    request(sunrise, bread, 10, "pending", "Dinner tomorrow", age=0)
    request(galle, dhal, 12, "accepted", "Collecting at 5", age=0)
    request(recipients["badulla-youth-shelter"], carrots, 20, "declined", reason="Already promised to another shelter", age=2)
    request(ngos["lanka-meals"], curry, 10, "pending", "For the evening kitchen", age=0)
    db.flush()
    for listing in listings.values():
        if listing.quantity_available <= 0:
            listing.status = "sold_out"

    db.add(Rating(request_id=done_a.id, rater_id=sunrise.id, ratee_id=done_a.listing.donor_id, score=5, comment="Warm bread, lovely people."))
    db.add(Rating(request_id=done_a.id, rater_id=done_a.listing.donor_id, ratee_id=sunrise.id, score=5, comment="On time and well organised."))
    db.add(Rating(request_id=done_b.id, rater_id=hope.id, ratee_id=done_b.listing.donor_id, score=4, comment="Good fruit, a little hard to find the gate."))
    for slug, rating, comment in DESCRIPTION_FEEDBACK:
        db.add(Feedback(recipient_id=recipients[slug].id, rating=rating, comment=comment, feedback_status="open", created_at=ago(2)))

    def event(slug, title, days, hours, district, location, etype, desc, cap):
        start = ahead(days * 24)
        db.add(CommunityEvent(
            owner_id=ngos[slug].id, title=title, description=desc, event_type=etype, district=district, location=location,
            starts_at=start, ends_at=start + timedelta(hours=hours), capacity=cap, contact_name="Event desk",
            contact_phone="0112 000 000", status="published"))
    event("lanka-meals", "Community kitchen cook-along", 3, 4, "Colombo", "Slave Island community hall", "volunteering", "Cook 400 meals together for city families.", 30)
    event("hill-food-bank", "Highland harvest food drive", 5, 5, "Nuwara Eliya", "Nuwara Eliya town market", "food_drive", "Bring surplus vegetables for estate families.", None)
    event("ruhuna-table", "Elders' lunch and meal packing", 8, 3, "Matara", "Matara temple hall", "distribution", "Pack and deliver lunches to elderly neighbours.", 20)
    db.add(Notification(user_id=sunrise.id, kind="request_completed", title="Handover completed - please leave a rating",
                        body="Fresh bread loaves", link="/dashboard/requests", is_read=False))
    db.commit()
    return {"donors": len(donors), "recipients": len(recipients), "ngos": len(ngos), "listings": len(listings)}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--yes", action="store_true", help="really write to the database")
    ap.add_argument("--remove", action="store_true", help="only delete the demo data")
    args = ap.parse_args()

    with engine.connect() as c:
        dbname = c.execute(text("select current_database()")).scalar()
    print(f"Database: {dbname}")
    if not (args.yes or args.remove):
        print("Dry run - nothing written. Re-run with --yes to seed or --remove to clean up.")
        return 0

    db = SessionLocal()
    try:
        removed = remove(db)
        if removed:
            print(f"Removed {removed} existing demo accounts and their data.")
        if args.remove:
            return 0
        print("Seeded:", seed(db))
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
