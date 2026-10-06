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
from datetime import date, datetime, timedelta

from sqlalchemy import text

from app.database import SessionLocal, engine
from app.models import Escalation, Feedback, FoodListing, FoodRequest, User

DOMAIN = "@demo.sharingexcess.lk"
TODAY = date.today()


def d(days: int) -> str:
    return (TODAY + timedelta(days=days)).isoformat()


def ago(days: int, hours: int = 0) -> datetime:
    return datetime.now() - timedelta(days=days, hours=hours)


DONORS = [
    # name, slug, phone, location
    ("Lanka Bakers", "lanka-bakers", "0112 445 210", "Colombo"),
    ("Hill Country Hotel", "hill-country-hotel", "0522 222 345", "Nuwara Eliya"),
    ("Seaside Restaurant", "seaside-restaurant", "0912 224 118", "Galle"),
    ("Kandy Lake Catering", "kandy-lake-catering", "0812 233 907", "Kandy"),
    ("Green Valley Farm", "green-valley-farm", "0552 223 640", "Badulla"),
    ("Northern Sweets", "northern-sweets", "0212 221 506", "Jaffna"),
    ("Negombo Fish Market Co-op", "negombo-coop", "0312 222 871", "Negombo"),
    ("Harbour View Hotel", "harbour-view-hotel", "0472 223 005", "Matara"),
]

RECIPIENTS = [
    ("Sunrise Children's Home", "sunrise-childrens-home", "0112 887 410", "Colombo"),
    ("Hope Elders' Care", "hope-elders-care", "0812 410 223", "Kandy"),
    ("Galle Community Kitchen", "galle-community-kitchen", "0912 245 667", "Galle"),
    ("Badulla Youth Shelter", "badulla-youth-shelter", "0552 230 118", "Badulla"),
    ("Jaffna Family Support", "jaffna-family-support", "0212 227 340", "Jaffna"),
    ("Anuradhapura Women's Circle", "anuradhapura-womens-circle", "0252 221 905", "Anuradhapura"),
]

# donor slug, food, quantity, days until best-before, location, description, listing status, verification
LISTINGS = [
    ("lanka-bakers", "Fresh bread loaves", "40 loaves", 1, "Pettah, Colombo", "Baked this morning, unsold at closing. Sliced and bagged.", "available", "approved"),
    ("lanka-bakers", "Assorted buns and rolls", "60 pieces", 1, "Fort, Colombo", "Fish buns, egg rolls and plain buns.", "available", "approved"),
    ("hill-country-hotel", "Vegetable curry and rice", "30 meals", 0, "Nuwara Eliya", "Buffet surplus from a wedding lunch, kept hot and packed in containers.", "available", "approved"),
    ("seaside-restaurant", "Cooked rice and dhal", "25 packets", 0, "Galle Fort, Galle", "Packed lunch portions, ready to collect before 6 pm.", "available", "approved"),
    ("kandy-lake-catering", "Fruit platter leftovers", "12 kg", 2, "Kandy", "Pineapple, papaya and watermelon from a conference.", "available", "approved"),
    ("green-valley-farm", "Carrots and leeks", "50 kg", 4, "Bandarawela", "Slightly misshapen, perfectly good. Farm gate pickup.", "available", "approved"),
    ("green-valley-farm", "Cabbage", "80 kg", 5, "Welimada", "Fresh harvest, surplus after the weekly fair.", "available", "approved"),
    ("northern-sweets", "Milk toffee and sweets", "15 boxes", 20, "Jaffna", "Sealed boxes, long shelf life.", "available", "approved"),
    ("negombo-coop", "Dried fish", "30 kg", 30, "Negombo", "Salted and dried, packed in 1 kg bags.", "available", "approved"),
    ("harbour-view-hotel", "Breakfast pastries", "45 pieces", 1, "Matara", "Croissants and sweet buns from the morning buffet.", "available", "approved"),
    ("kandy-lake-catering", "Packed dinner boxes", "20 boxes", 0, "Peradeniya", "Event cancelled at short notice, all food fresh.", "available", "pending_review"),
    ("seaside-restaurant", "Seafood rice", "10 kg", 0, "Hikkaduwa", "Pickup today only.", "available", "rejected"),
    ("lanka-bakers", "Sandwich bread", "30 loaves", -3, "Pettah, Colombo", "Collected last week.", "accepted", "approved"),
    ("hill-country-hotel", "Tea and biscuits", "20 packs", -6, "Nuwara Eliya", "Delivered to the children's home.", "accepted", "approved"),
]

# recipient slug, food, quantity, needed-by offset, location, status, linked listing food (or None), age in days
REQUESTS = [
    ("sunrise-childrens-home", "Bread for breakfast", "30 loaves", 1, "Colombo", "pending", None, 0),
    ("hope-elders-care", "Soft fruit for elders", "8 kg", 2, "Kandy", "pending", None, 0),
    ("galle-community-kitchen", "Rice and curry packets", "40 packets", 0, "Galle", "pending", None, 0),
    ("badulla-youth-shelter", "Vegetables for the kitchen", "30 kg", 4, "Badulla", "pending", None, 1),
    ("jaffna-family-support", "Packed meals", "25 meals", 1, "Jaffna", "accepted", None, 1),
    ("sunrise-childrens-home", "Sandwich bread", "30 loaves", -3, "Colombo", "delivered", "Sandwich bread", 6),
    ("hope-elders-care", "Tea and biscuits", "20 packs", -6, "Kandy", "delivered", "Tea and biscuits", 10),
    ("galle-community-kitchen", "Bread and buns", "50 pieces", -9, "Galle", "delivered", None, 14),
    ("anuradhapura-womens-circle", "Fresh vegetables", "20 kg", -12, "Anuradhapura", "delivered", None, 18),
    ("badulla-youth-shelter", "Cooked meals", "15 meals", -2, "Badulla", "declined", None, 5),
]

FEEDBACK = [
    ("sunrise-childrens-home", 5, "The bread arrived warm and the children had a proper breakfast. Thank you to the bakery and to the field officer who arranged it so quickly."),
    ("hope-elders-care", 5, "Gentle, well-packed food for our elders. The donor even called ahead to confirm the pickup time."),
    ("galle-community-kitchen", 4, "Great quantity and everything was fresh. Pickup instructions could have been a little clearer, otherwise perfect."),
    ("anuradhapura-womens-circle", 5, "We fed more than sixty families from this one donation. This platform makes it simple to find help."),
    ("jaffna-family-support", 4, "Quick response from the donor and a friendly officer. We hope more donors in the north join."),
]


def remove(db) -> int:
    ids = [u.id for u in db.query(User).filter(User.email.like(f"%{DOMAIN}")).all()]
    if not ids:
        return 0
    req_ids = [r.id for r in db.query(FoodRequest).filter(FoodRequest.recipient_id.in_(ids)).all()]
    listing_ids = [item.id for item in db.query(FoodListing).filter(FoodListing.donor_id.in_(ids)).all()]
    db.query(Escalation).filter(Escalation.raised_by.in_(ids)).delete(synchronize_session=False)
    db.query(Feedback).filter((Feedback.recipient_id.in_(ids)) | (Feedback.request_id.in_(req_ids))).delete(synchronize_session=False)
    # requests that real users made on a demo listing keep working: just unlink them
    if listing_ids:
        db.query(FoodRequest).filter(FoodRequest.listing_id.in_(listing_ids), ~FoodRequest.recipient_id.in_(ids)).update(
            {FoodRequest.listing_id: None}, synchronize_session=False)
    db.query(FoodRequest).filter(FoodRequest.recipient_id.in_(ids)).delete(synchronize_session=False)
    db.query(FoodListing).filter(FoodListing.donor_id.in_(ids)).delete(synchronize_session=False)
    db.query(User).filter(User.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return len(ids)


def seed(db) -> dict:
    from app.utils.security import hash_password

    unusable = hash_password(secrets.token_urlsafe(32))  # nobody knows it: demo accounts cannot sign in
    donors, recipients = {}, {}
    for name, slug, phone, loc in DONORS:
        u = User(name=name, email=f"{slug}{DOMAIN}", password=unusable, role="donor", status="active",
                 phone_number=phone, location=loc, created_at=ago(40))
        db.add(u)
        donors[slug] = u
    for name, slug, phone, loc in RECIPIENTS:
        u = User(name=name, email=f"{slug}{DOMAIN}", password=unusable, role="recipient", status="active",
                 phone_number=phone, location=loc, created_at=ago(35))
        db.add(u)
        recipients[slug] = u
    db.flush()

    listings = {}
    for i, (slug, food, qty, days, loc, desc, status, ver) in enumerate(LISTINGS):
        donor = donors[slug]
        row = FoodListing(
            donor_id=donor.id, food_name=food, quantity=qty, expiry_date=d(days), location=loc, description=desc,
            contact_phone=donor.phone_number, contact_email=donor.email, status=status, verification_status=ver,
            rejection_reason="Cooked seafood must be refrigerated within 2 hours - please relist with the time it was prepared."
            if ver == "rejected" else None,
            accepted_by=donor.name if status == "accepted" else None,
            created_at=ago(i % 7, i),
        )
        db.add(row)
        listings[food] = row
    db.flush()

    requests = []
    for recipient_slug, food, qty, days, loc, status, linked, age in REQUESTS:
        recipient = recipients[recipient_slug]
        listing = listings.get(linked) if linked else None
        row = FoodRequest(
            recipient_id=recipient.id, food_name=food, quantity=qty, needed_by=d(days), location=loc, status=status,
            listing_id=listing.id if listing else None,
            accepted_by=(listing.donor.name if listing and listing.donor else "Lanka Bakers")
            if status in ("accepted", "delivered") else None,
            created_at=ago(age),
        )
        db.add(row)
        requests.append(row)
    db.flush()

    delivered_by_recipient = {r.recipient_id: r for r in requests if r.status == "delivered"}
    for slug, rating, comment in FEEDBACK:
        rec = recipients[slug]
        req = delivered_by_recipient.get(rec.id)
        db.add(Feedback(recipient_id=rec.id, request_id=req.id if req else None, rating=rating, comment=comment,
                        feedback_status="open", created_at=ago(2 + rating)))
    db.commit()
    return {"donors": len(donors), "recipients": len(recipients), "listings": len(listings), "requests": len(requests),
            "feedback": len(FEEDBACK)}


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
