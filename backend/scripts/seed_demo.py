"""Fill the database with clearly-labelled demo data so every page has something to show.

    python -m scripts.seed_demo --yes                       # (re)create the demo data
    python -m scripts.seed_demo --yes --password "Demo#2026"  # same, and demo accounts can sign in with that password
    python -m scripts.seed_demo --remove                   # delete only the demo data

Safe by design:
  * every demo account uses the @demo.sharingexcess.lk domain, which is how --remove finds them
  * running it twice does not duplicate anything (old demo rows are replaced)
  * real accounts and their data are never touched
  * without --password the demo accounts have no usable password and cannot log in
Back up first if the database holds anything you care about (pg_dump).
"""
import argparse
import random
import secrets
import sys
from datetime import datetime, timedelta
from decimal import Decimal

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import text

from app.database import SessionLocal, engine
from app.models import (
    CommunityEvent,
    EventSignup,
    EventSubscriber,
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
from app.utils.uploads import UPLOAD_DIR, delete_upload

DOMAIN = "@demo.sharingexcess.lk"
CONTACT = "admin.sharingexcess@gmail.com"
rnd = random.Random(2026)  # fixed seed: the same data every run


def ago(days: float = 0, hours: float = 0) -> datetime:
    return now_colombo() - timedelta(days=days, hours=hours)


def ahead(hours: float) -> datetime:
    return now_colombo() + timedelta(hours=hours)


# colour pairs for generated profile pictures (no real people's photos are used)
PALETTES = [("#16a34a", "#0d9488"), ("#2563eb", "#7c3aed"), ("#ea580c", "#db2777"), ("#0891b2", "#2563eb"),
            ("#7c3aed", "#db2777"), ("#ca8a04", "#ea580c"), ("#be123c", "#f59e0b"), ("#0f766e", "#65a30d")]
FONTS = ["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf", "DejaVuSans-Bold.ttf"]


def _font(size: int):
    for f in FONTS:
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            continue
    return ImageFont.load_default()


def initials(name: str) -> str:
    words = [w for w in name.replace("'", "").replace("&", " ").replace("(", " ").split() if w[:1].isalpha()]
    skip = {"the", "of", "and"}
    words = [w for w in words if w.lower() not in skip] or ["?"]
    return (words[0][0] + (words[1][0] if len(words) > 1 else "")).upper()


def make_avatar(name: str, slug: str) -> str:
    """A bright gradient tile with soft shapes and the account's initials, saved like a normal upload."""
    size = 480
    a, b = PALETTES[rnd.randrange(len(PALETTES))]
    ca, cb = (tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in (a, b))
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = tuple(int(ca[k] + (cb[k] - ca[k]) * t) for k in range(3))
    over = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    for _ in range(4):  # soft translucent circles
        r = rnd.randint(70, 190)
        cx, cy = rnd.randint(-40, size + 40), rnd.randint(-40, size + 40)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, rnd.randint(22, 48)))
    img = Image.alpha_composite(img.convert("RGBA"), over)
    d = ImageDraw.Draw(img)
    text_ = initials(name)
    font = _font(210 if len(text_) == 1 else 190)
    box = d.textbbox((0, 0), text_, font=font)
    pos = ((size - (box[2] - box[0])) / 2 - box[0], (size - (box[3] - box[1])) / 2 - box[1])
    d.text((pos[0] + 5, pos[1] + 7), text_, font=font, fill=(0, 0, 0, 70))
    d.text(pos, text_, font=font, fill="white")
    fname = f"avatar_demo_{slug}.webp"
    delete_upload(f"/uploads/{fname}")
    img.convert("RGB").save(UPLOAD_DIR / fname, format="WEBP", quality=86)
    return f"/uploads/{fname}"


def phone() -> str:
    return f"07{rnd.choice('01245678')} {rnd.randint(100, 999)} {rnd.randint(1000, 9999)}"


# name, slug, kind, district, town
DONORS = [
    ("Lanka Bakers", "lanka-bakers", "bakery", "Colombo", "Pettah"),
    ("Cinnamon Crust Bakery", "cinnamon-crust", "bakery", "Colombo", "Bambalapitiya"),
    ("Golden Oven Bakery", "golden-oven", "bakery", "Gampaha", "Ja-Ela"),
    ("Kandy Hill Bakehouse", "kandy-bakehouse", "bakery", "Kandy", "Peradeniya"),
    ("Hill Country Hotel", "hill-country-hotel", "hotel", "Nuwara Eliya", "Nuwara Eliya"),
    ("Harbour View Hotel", "harbour-view-hotel", "hotel", "Matara", "Matara"),
    ("Lagoon Beach Resort", "lagoon-resort", "hotel", "Kalutara", "Wadduwa"),
    ("Trinco Bay Hotel", "trinco-bay-hotel", "hotel", "Trincomalee", "Uppuveli"),
    ("Seaside Restaurant", "seaside-restaurant", "restaurant", "Galle", "Galle Fort"),
    ("Spice Garden Restaurant", "spice-garden", "restaurant", "Colombo", "Dehiwala"),
    ("Amma's Kitchen", "ammas-kitchen", "restaurant", "Kurunegala", "Kurunegala"),
    ("Rice & Curry Corner", "rice-curry-corner", "restaurant", "Anuradhapura", "Anuradhapura"),
    ("Kandy Lake Catering", "kandy-lake-catering", "caterer", "Kandy", "Kandy"),
    ("Royal Feast Caterers", "royal-feast", "caterer", "Colombo", "Nugegoda"),
    ("Southern Events Catering", "southern-events", "caterer", "Galle", "Hikkaduwa"),
    ("Green Valley Farm", "green-valley-farm", "farm", "Badulla", "Bandarawela"),
    ("Dambulla Growers Co-op", "dambulla-growers", "farm", "Matale", "Dambulla"),
    ("Ratnapura Orchard", "ratnapura-orchard", "farm", "Ratnapura", "Balangoda"),
    ("Jaffna Fresh Farm", "jaffna-fresh-farm", "farm", "Jaffna", "Chavakachcheri"),
    ("Northern Sweets", "northern-sweets", "sweets", "Jaffna", "Jaffna"),
    ("Sweet Tooth Confectioners", "sweet-tooth", "sweets", "Kegalle", "Mawanella"),
    ("Negombo Fish Market Co-op", "negombo-coop", "fish", "Gampaha", "Negombo"),
    ("Batticaloa Lagoon Fishers", "batti-fishers", "fish", "Batticaloa", "Batticaloa"),
    ("Fresh Mart Supermarket", "fresh-mart", "market", "Colombo", "Maharagama"),
    ("City Basket Stores", "city-basket", "market", "Kandy", "Katugastota"),
    ("Hambantota Salt & Spice", "hambantota-spice", "market", "Hambantota", "Tissamaharama"),
]

# What each kind of donor tends to give away: food, category, unit, (min, max) quantity, description, fulfilment
KINDS = {
    "bakery": [
        ("Fresh bread loaves", "bakery", "loaves", (20, 60), "Baked this morning, unsold at closing. Sliced and bagged.", "both"),
        ("Assorted buns and rolls", "bakery", "pieces", (40, 90), "Fish buns, egg rolls and plain buns.", "pickup"),
        ("Cakes and pastries", "bakery", "pieces", (12, 30), "Day-old but still soft and fresh. Boxed.", "pickup"),
    ],
    "hotel": [
        ("Breakfast buffet surplus", "cooked_meals", "portions", (20, 50), "Hoppers, string hoppers, sambol and curry, packed in containers.", "pickup"),
        ("Vegetable curry and rice", "cooked_meals", "meals", (20, 40), "Buffet surplus from a wedding lunch.", "pickup"),
        ("Croissants and sweet buns", "bakery", "pieces", (25, 60), "Morning buffet leftovers.", "pickup"),
    ],
    "restaurant": [
        ("Cooked rice and dhal", "cooked_meals", "packets", (15, 35), "Packed lunch portions, ready to collect before 6 pm.", "both"),
        ("Kottu and fried rice portions", "cooked_meals", "portions", (10, 25), "Cooked this evening, still warm at closing.", "pickup"),
        ("Rice and three curries", "cooked_meals", "packets", (20, 40), "Lunch packets prepared for an order that was cancelled.", "both"),
    ],
    "caterer": [
        ("Packed dinner boxes", "cooked_meals", "boxes", (15, 40), "Event cancelled at short notice, all food fresh.", "both"),
        ("Fruit platter leftovers", "vegetables_fruits", "kg", (6, 18), "Pineapple, papaya and watermelon from a conference.", "pickup"),
        ("Mixed rice and curry trays", "cooked_meals", "meals", (30, 80), "Wedding reception surplus, packed in foil trays.", "pickup"),
    ],
    "farm": [
        ("Carrots and leeks", "vegetables_fruits", "kg", (30, 90), "Slightly misshapen, perfectly good. Farm gate pickup.", "pickup"),
        ("Cabbage", "vegetables_fruits", "kg", (50, 140), "Fresh harvest, surplus after the weekly fair.", "both"),
        ("Bananas and papaya", "vegetables_fruits", "kg", (20, 60), "Ripe fruit that will not survive transport to market.", "pickup"),
        ("Pumpkin and snake gourd", "vegetables_fruits", "kg", (25, 70), "Garden vegetables, harvested yesterday.", "pickup"),
    ],
    "sweets": [
        ("Milk toffee and sweets", "packaged", "boxes", (10, 25), "Sealed boxes, long shelf life.", "pickup"),
        ("Wattalapam and kavum", "packaged", "packs", (15, 40), "Festival leftovers, individually wrapped.", "both"),
    ],
    "fish": [
        ("Dried fish", "packaged", "kg", (15, 45), "Salted and dried, packed in 1 kg bags.", "delivery"),
        ("Fresh fish catch", "other", "kg", (10, 30), "Morning catch on ice, best used the same day.", "pickup"),
    ],
    "market": [
        ("Bread, milk and eggs near date", "dairy_eggs", "packs", (20, 50), "Short-dated but fully safe, checked this morning.", "pickup"),
        ("Packaged biscuits and snacks", "packaged", "packs", (30, 80), "Damaged outer boxes, contents untouched.", "pickup"),
        ("Rice and lentils (damaged bags)", "rice_grains", "kg", (25, 80), "Re-bagged and weighed. Clean and dry.", "both"),
        ("Fruit juice cartons", "beverages", "pieces", (24, 72), "Sealed, best before is next week.", "pickup"),
    ],
}

# name, slug, district, kind ("home", "shelter", "kitchen", "person")
RECIPIENTS = [
    ("Sunrise Children's Home", "sunrise-childrens-home", "Colombo"),
    ("Hope Elders' Care", "hope-elders-care", "Kandy"),
    ("Galle Community Kitchen", "galle-community-kitchen", "Galle"),
    ("Badulla Youth Shelter", "badulla-youth-shelter", "Badulla"),
    ("Jaffna Family Support", "jaffna-family-support", "Jaffna"),
    ("Anuradhapura Women's Circle", "anuradhapura-womens-circle", "Anuradhapura"),
    ("Little Lotus Orphanage", "little-lotus", "Gampaha"),
    ("Mount Lavinia Elders' Home", "mt-lavinia-elders", "Colombo"),
    ("Kurunegala Temple Dana Committee", "kurunegala-dana", "Kurunegala"),
    ("Matara Street Kids Project", "matara-street-kids", "Matara"),
    ("Nuwara Eliya Estate Crèche", "ne-estate-creche", "Nuwara Eliya"),
    ("Trinco Fishing Families Fund", "trinco-families", "Trincomalee"),
    ("Batticaloa Widows' Association", "batti-widows", "Batticaloa"),
    ("Ratnapura Student Hostel", "ratnapura-hostel", "Ratnapura"),
    ("Kalutara Disability Centre", "kalutara-disability", "Kalutara"),
    ("Hambantota Village Pantry", "hambantota-pantry", "Hambantota"),
    ("Nimal Perera", "nimal-perera", "Colombo"),
    ("Kumari Wickramasinghe", "kumari-w", "Kandy"),
    ("Saman Kumara", "saman-kumara", "Galle"),
    ("Priya Fernando", "priya-fernando", "Gampaha"),
    ("Ravi Selvam", "ravi-selvam", "Jaffna"),
    ("Fathima Rizwan", "fathima-rizwan", "Kandy"),
    ("Dilshan Jayasuriya", "dilshan-j", "Matara"),
    ("Anjali Rajapaksa", "anjali-r", "Kurunegala"),
]

# slug, name, description, district, ngo_status
NGOS = [
    ("lanka-meals", "Lanka Meals Collective", "A volunteer-run kitchen turning donated ingredients into hot meals for city families.", "Colombo", "approved"),
    ("hill-food-bank", "Hill Country Food Bank", "Collects surplus vegetables from highland farms and shares them with estate communities.", "Nuwara Eliya", "approved"),
    ("ruhuna-table", "Ruhuna Community Table", "A weekly shared lunch, plus packed meals for elderly neighbours.", "Matara", "approved"),
    ("kandy-harvest", "Kandy Harvest Network", "Links hill-country farms and Kandy hotels with families who need fresh food.", "Kandy", "approved"),
    ("northern-hands", "Northern Hands Foundation", "Feeds families rebuilding their livelihoods across Jaffna and Kilinochchi.", "Jaffna", "approved"),
    ("east-coast-kitchen", "East Coast Kitchen", "Community kitchen serving fishing villages around Batticaloa and Trincomalee.", "Batticaloa", "approved"),
    ("southern-sharing", "Southern Sharing Circle", "Volunteers rescuing hotel and bakery surplus along the southern coast.", "Galle", "approved"),
    ("rajarata-relief", "Rajarata Relief Trust", "Food parcels and school meals for farming communities in the dry zone.", "Anuradhapura", "approved"),
    ("new-hope", "New Hope Trust", "Recently registered, waiting for approval.", "Kurunegala", "pending"),
    ("green-leaf", "Green Leaf Society", "Registered last week, waiting for approval.", "Kegalle", "pending"),
    ("sample-rejected", "Unverified Charity Group", "Could not be verified.", "Puttalam", "rejected"),
]

MESSAGES = [
    "Breakfast for the children tomorrow morning.", "We will collect within the hour, thank you!", "For our weekly community lunch.",
    "Feeding about 30 people this evening.", "Can we please collect after 5 pm?", "For the elders at our home.",
    "Would be a big help for the kitchen today.", None, None, "Two families are waiting for this.",
]
DECLINES = ["Already promised to someone nearby", "Sorry, this was reserved earlier", "Too far for the food to stay fresh"]
RATING_TO_DONOR = [
    (5, "Warm food, lovely people. Thank you!"), (5, "Very generous and easy to coordinate with."),
    (4, "Good quality, a little hard to find the gate."), (5, "Packed neatly and ready when we arrived."),
    (4, "Great food, pickup instructions could be clearer."), (5, "The children loved it."),
]
RATING_TO_RECIPIENT = [
    (5, "On time and well organised."), (5, "Polite, thankful and quick."), (4, "Arrived a little late but communicated well."),
    (5, "A pleasure to hand over to."),
]
FEEDBACK = [
    (5, "Such a simple way to stop good food being wasted. Our home received meals three times this month."),
    (4, "Lovely platform. It would help to see the exact pickup time on the listing card."),
    (5, "Our bakery used to throw away 30 loaves a day. Now they feed families nearby."),
    (5, "The nearby-first ordering really works, we got food within minutes of posting."),
    (3, "Good idea, but I would like more notification options for evenings."),
    (5, "The Sinhala version helped our volunteers a lot. Thank you!"),
]

# slug, title, days from now (negative = past), hours long, district, venue, type, description, capacity
EVENTS = [
    ("lanka-meals", "Community kitchen cook-along", 3, 4, "Colombo", "Slave Island community hall", "volunteering", "Cook 400 meals together for city families. All skill levels welcome, aprons provided.", 30),
    ("hill-food-bank", "Highland harvest food drive", 5, 5, "Nuwara Eliya", "Nuwara Eliya town market", "food_drive", "Bring surplus vegetables for estate families, or help us sort and pack.", None),
    ("ruhuna-table", "Elders' lunch and meal packing", 8, 3, "Matara", "Matara temple hall", "distribution", "Pack and deliver lunches to elderly neighbours.", 20),
    ("kandy-harvest", "Fruit and vegetable rescue run", 2, 3, "Kandy", "Kandy Municipal Market", "food_drive", "Collect unsold produce from market stalls and redistribute to three local homes.", 25),
    ("kandy-harvest", "Zero-waste cooking workshop", 12, 3, "Kandy", "Kandy City Centre, level 3", "workshop", "Learn to cook delicious meals from kitchen scraps and near-date produce.", 40),
    ("northern-hands", "Jaffna community dana", 6, 4, "Jaffna", "Nallur community grounds", "distribution", "A shared meal and food parcels for 200 families. Volunteers needed from 7 am.", 60),
    ("northern-hands", "Food safety awareness talk", 15, 2, "Jaffna", "Jaffna Public Library hall", "awareness", "How to store, pack and share cooked food safely. Free for restaurants and donors.", 80),
    ("east-coast-kitchen", "Fishing village feeding day", 4, 5, "Batticaloa", "Kallady beach shelter", "distribution", "Hot meals and dry rations for fishing families after the monsoon.", 50),
    ("southern-sharing", "Galle Fort bakery rescue night", 1, 3, "Galle", "Galle Fort, Church Street", "volunteering", "Evening pick-up of unsold bread from bakeries, delivered to shelters before midnight.", 15),
    ("southern-sharing", "Beach clean-up and community lunch", 10, 5, "Galle", "Unawatuna beach", "volunteering", "Clean the beach in the morning, share a lunch made from rescued food.", 60),
    ("rajarata-relief", "School meals launch", 9, 3, "Anuradhapura", "Mihintale Primary School", "distribution", "Launching weekly meals for 150 schoolchildren. Come cook and serve.", 35),
    ("lanka-meals", "Hunger awareness walk", 18, 3, "Colombo", "Galle Face Green", "awareness", "A morning walk to raise awareness of food waste and hunger in Sri Lanka.", None),
    ("hill-food-bank", "Estate families food parcel day", 22, 4, "Nuwara Eliya", "Pedro estate community centre", "distribution", "Pack and hand out 300 food parcels.", 45),
    ("lanka-meals", "Community kitchen cook-along (past)", -9, 4, "Colombo", "Slave Island community hall", "volunteering", "400 meals cooked and shared. Thank you to every volunteer!", 30),
    ("northern-hands", "Pongal food drive (past)", -16, 5, "Jaffna", "Jaffna Town Hall", "food_drive", "Collected rice, lentils and sweets for 120 families.", None),
    ("ruhuna-table", "Elders' lunch (past)", -5, 3, "Matara", "Matara temple hall", "distribution", "Lunch for 80 elders. See you at the next one!", 20),
]


def remove(db) -> int:
    users = db.query(User).filter(User.email.like(f"%{DOMAIN}")).all()
    for u in users:
        purge_user(db, u)
    db.query(EventSubscriber).filter(EventSubscriber.email.like(f"%{DOMAIN}")).delete(synchronize_session=False)
    db.query(Report).filter(Report.reporter_id.is_(None), Report.reason.like("[demo]%")).delete(synchronize_session=False)
    db.commit()
    return len(users)


def seed(db, password: str | None) -> dict:
    from app.utils.security import hash_password

    pw = hash_password(password or secrets.token_urlsafe(32))  # without --password nobody knows it
    donors, recipients, ngos = {}, {}, {}
    for name, slug, kind, district, town in DONORS:
        u = User(name=name, email=f"{slug}{DOMAIN}", password=pw, role="donor", status="active", phone_number=phone(),
                 location=town, district=district, created_at=ago(rnd.randint(25, 75)))
        u.kind = kind
        db.add(u)
        donors[slug] = u
    for name, slug, district in RECIPIENTS:
        u = User(name=name, email=f"{slug}{DOMAIN}", password=pw, role="recipient", status="active", phone_number=phone(),
                 location=district, district=district, created_at=ago(rnd.randint(20, 70)))
        db.add(u)
        recipients[slug] = u
    for slug, name, desc, district, status in NGOS:
        u = User(name=f"{name} (contact)", email=f"{slug}{DOMAIN}", password=pw, role="ngo", status="active",
                 phone_number=phone(), district=district, org_name=name, org_description=desc, ngo_status=status,
                 created_at=ago(rnd.randint(15, 60)))
        db.add(u)
        ngos[slug] = u
    # ~90% have a picture; the rest show the initial, so both states are visible
    for slug, u in {**donors, **recipients, **ngos}.items():
        if rnd.random() < 0.9:
            url = make_avatar(u.org_name or u.name, slug)
            if u.role == "ngo":
                u.org_logo = url
            else:
                u.avatar = url
    db.flush()

    # ---- listings: each donor posts 2-4 over the last weeks, some still live, some finished ----
    listings: list[FoodListing] = []
    for donor in donors.values():
        picks = rnd.sample(KINDS[donor.kind], k=min(len(KINDS[donor.kind]), rnd.randint(2, 3)))
        for food, cat, unit, (lo, hi), desc, fulfil in picks:
            total = Decimal(rnd.randint(lo, hi))
            age_days = rnd.choice([0, 0, 0, 1, 1, 2, 3, 5, 8, 12])
            live = age_days <= 1 or rnd.random() < 0.35
            hours = rnd.randint(3, 72) if cat in ("cooked_meals",) else rnd.randint(8, 240)
            if cat == "packaged":
                hours = rnd.randint(300, 800)
            expires = ahead(hours) if live else ago(max(age_days - 1, 0), rnd.randint(1, 20))
            row = FoodListing(
                donor_id=donor.id, food_name=food, description=desc, category=cat, quantity_total=total,
                quantity_available=total, unit=unit, district=donor.district, area=donor.location,
                pickup_address=f"{donor.location}, {donor.district} (demo address)", contact_phone=donor.phone_number,
                expires_at=expires, fulfilment=fulfil, images=[], safety_confirmed=True,
                prepared_at=ago(age_days, 3) if cat == "cooked_meals" else None,
                status="active" if live else "expired", created_at=ago(age_days, rnd.randint(0, 6)),
            )
            db.add(row)
            listings.append(row)
    db.flush()

    # ---- requests: pending / accepted / collected / completed / declined / cancelled / no_show on the listings ----
    asking = list(recipients.values()) + [n for n in ngos.values() if n.ngo_status == "approved"]
    requests: list[FoodRequest] = []

    def make_request(listing, who, status, age_days):
        left = listing.quantity_available
        if left <= 0:
            return None
        qty = Decimal(max(1, min(int(left), rnd.randint(1, max(1, int(listing.quantity_total) // 3)))))
        r = FoodRequest(recipient_id=who.id, listing_id=listing.id, quantity_requested=qty, status=status,
                        message=rnd.choice(MESSAGES), created_at=ago(age_days, 5))
        if status != "pending":
            r.responded_at = ago(age_days, 4)
        if status == "declined":
            r.decline_reason = rnd.choice(DECLINES)
        if status in ("collected", "completed"):
            r.collected_at = ago(age_days, 3)
        if status == "completed":
            r.completed_at = ago(age_days, 2)
        db.add(r)
        if status in ("pending", "accepted", "collected", "completed"):
            listing.quantity_available -= qty
        requests.append(r)
        return r

    for listing in listings:
        live = listing.status == "active"
        age = max((now_colombo() - listing.created_at).days, 0)
        who = rnd.sample(asking, k=rnd.randint(1, 4))
        for person in who:
            if live:
                status = rnd.choice(["pending", "pending", "accepted", "accepted", "declined", "cancelled"])
                make_request(listing, person, status, 0 if age == 0 else rnd.randint(0, age))
            else:
                status = rnd.choice(["completed", "completed", "completed", "completed", "declined", "no_show", "cancelled"])
                make_request(listing, person, status, age + rnd.randint(0, 2))
    db.flush()

    for listing in listings:
        if listing.status == "active" and listing.quantity_available <= 0:
            listing.status = "sold_out"
        if listing.status == "expired" and rnd.random() < 0.15:
            listing.status = "closed"

    # ---- ratings both ways on completed handovers, plus feedback to the platform ----
    done = [r for r in requests if r.status == "completed"]
    rated = 0
    for r in done:
        donor_id = r.listing.donor_id
        if rnd.random() < 0.8:
            score, comment = rnd.choice(RATING_TO_DONOR)
            db.add(Rating(request_id=r.id, rater_id=r.recipient_id, ratee_id=donor_id, score=score, comment=comment, created_at=r.completed_at))
            rated += 1
        if rnd.random() < 0.55:
            score, comment = rnd.choice(RATING_TO_RECIPIENT)
            db.add(Rating(request_id=r.id, rater_id=donor_id, ratee_id=r.recipient_id, score=score, comment=comment, created_at=r.completed_at))
            rated += 1
    for (rating, comment), who in zip(FEEDBACK, rnd.sample(list(recipients.values()) + list(donors.values()), k=len(FEEDBACK)), strict=True):
        db.add(Feedback(recipient_id=who.id, rating=rating, comment=comment, feedback_status="open", created_at=ago(rnd.randint(1, 12))))

    # ---- events and sign-ups ----
    people = list(recipients.values()) + list(donors.values())
    events = []
    for slug, title, days, hours, district, location, etype, desc, cap in EVENTS:
        owner = ngos[slug]
        start = ahead(days * 24).replace(hour=rnd.choice([7, 8, 9, 10, 14, 15, 16, 17]), minute=rnd.choice([0, 0, 30]), second=0, microsecond=0)
        ev = CommunityEvent(
            owner_id=owner.id, title=title, description=desc, event_type=etype, district=district, location=location,
            starts_at=start, ends_at=start + timedelta(hours=hours), capacity=cap, contact_name=owner.org_name,
            contact_phone=owner.phone_number, contact_email=CONTACT, status="published",
            created_at=ago(rnd.randint(3, 20)) if days > 0 else start - timedelta(days=14))
        db.add(ev)
        events.append((ev, cap, days))
    db.flush()
    signups = 0
    for ev, cap, days in events:
        n = min(rnd.randint(4, 18), cap if cap else 99)
        if cap and days > 0 and rnd.random() < 0.2:
            n = cap  # one or two events that are already full
        for u in rnd.sample(people, k=min(n, len(people))):
            db.add(EventSignup(event_id=ev.id, user_id=u.id, created_at=ago(rnd.randint(0, 6))))
            signups += 1
    for i in range(12):
        db.add(EventSubscriber(email=f"subscriber{i + 1}{DOMAIN}"))

    # ---- moderation queue and notifications ----
    live = [x for x in listings if x.status == "active"]
    for reason, target in [("[demo] The photo does not match the food described.", rnd.choice(live)),
                           ("[demo] Quantity looks too large to be real.", rnd.choice(live))]:
        db.add(Report(reporter_id=None, target_type="listing", target_id=target.id, reason=reason, status="open"))
    db.add(Report(reporter_id=None, target_type="event", target_id=events[3][0].id, reason="[demo] Venue address seems incorrect.",
                  status="dismissed", admin_note="Checked with the organiser, address is correct."))
    for r in rnd.sample(done, k=min(8, len(done))):
        db.add(Notification(user_id=r.recipient_id, kind="request_completed", title="Handover completed - please leave a rating",
                            body=r.listing.food_name, link="/recipient-dashboard", is_read=rnd.random() < 0.5, created_at=r.completed_at))
    for r in [x for x in requests if x.status == "pending"][:10]:
        db.add(Notification(user_id=r.listing.donor_id, kind="request_received", title="New request for your food",
                            body=r.listing.food_name, link="/donor-dashboard", is_read=False, created_at=r.created_at))
    db.commit()
    by_status: dict[str, int] = {}
    for r in requests:
        by_status[r.status] = by_status.get(r.status, 0) + 1
    return {"donors": len(donors), "recipients": len(recipients), "ngos": len(ngos), "listings": len(listings),
            "requests": by_status, "ratings": rated, "events": len(events), "signups": signups}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--yes", action="store_true", help="really write to the database")
    ap.add_argument("--remove", action="store_true", help="only delete the demo data")
    ap.add_argument("--password", help="give every demo account this password so you can sign in as them")
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
        print("Seeded:", seed(db, args.password))
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
