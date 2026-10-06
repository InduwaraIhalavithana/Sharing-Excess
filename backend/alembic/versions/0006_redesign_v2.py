"""redesign v2: districts, stock-tracked listings and requests, NGOs, notifications, ratings, reports

One admin account (officer role removed), listings go live without review, requests hold stock,
PayHere money donations removed.

Rollback safety: before anything is changed the old tables are copied to legacy_v1_* (enum columns
as text). downgrade() restores the old schema and brings those rows back; a later migration may drop
the legacy_v1_* tables once the redesign is settled. A pg_dump taken before upgrading is the second net.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-06
"""
import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

# Free-text place names that identify a district (users typed "Pettah, Colombo", "Bandarawela", ...).
# A frozen copy: a migration must not change behaviour when app.constants changes later.
_DISTRICTS = [
    "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle", "Gampaha", "Hambantota",
    "Jaffna", "Kalutara", "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar", "Matale",
    "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya", "Polonnaruwa", "Puttalam", "Ratnapura",
    "Trincomalee", "Vavuniya",
]
_TOWNS = {
    "Negombo": "Gampaha", "Bandarawela": "Badulla", "Welimada": "Badulla", "Peradeniya": "Kandy",
    "Hikkaduwa": "Galle", "Moratuwa": "Colombo", "Kotte": "Colombo", "Dehiwala": "Colombo",
    "Nugegoda": "Colombo", "Panadura": "Kalutara", "Kelaniya": "Gampaha", "Ja-Ela": "Gampaha",
    "Unawatuna": "Galle", "Weligama": "Matara", "Tangalle": "Hambantota", "Dambulla": "Matale",
    "Kataragama": "Monaragala", "Haputale": "Badulla", "Ella": "Badulla",
}

_QTY_NUMBER = r"^\s*([0-9]+(\.[0-9]+)?)"

_LEGACY = ("users", "food_listings", "food_requests", "escalations", "money_donations")


def _snapshot(table: str) -> None:
    """legacy_v1_<table>: a plain copy with enum columns turned into text (so the enum types can be replaced)."""
    insp = sa.inspect(op.get_bind())
    cols = []
    for c in insp.get_columns(table):
        name = f'"{c["name"]}"'
        cols.append(f"{name}::text AS {name}" if isinstance(c["type"], sa.Enum) or c["type"].__class__.__name__ == "ENUM"
                    else name)
    op.execute(f"DROP TABLE IF EXISTS legacy_v1_{table}")
    op.execute(f"CREATE TABLE legacy_v1_{table} AS SELECT {', '.join(cols)} FROM {table}")


def _infer_district(table: str, column: str, target: str = "district") -> None:
    for name in _DISTRICTS:
        op.execute(sa.text(f"UPDATE {table} SET {target} = :d WHERE {target} IS NULL AND {column} ILIKE :p")
                   .bindparams(d=name, p=f"%{name}%"))
    for town, name in _TOWNS.items():
        op.execute(sa.text(f"UPDATE {table} SET {target} = :d WHERE {target} IS NULL AND {column} ILIKE :p")
                   .bindparams(d=name, p=f"%{town}%"))


def upgrade() -> None:
    for t in _LEGACY:
        _snapshot(t)

    # ── users ────────────────────────────────────────────────────────────────
    op.add_column("users", sa.Column("district", sa.String(30), nullable=True))
    op.add_column("users", sa.Column("notify_districts", sa.dialects.postgresql.ARRAY(sa.Text()),
                                     nullable=False, server_default="{}"))
    op.add_column("users", sa.Column("notify_food_types", sa.dialects.postgresql.ARRAY(sa.Text()),
                                     nullable=False, server_default="{}"))
    op.add_column("users", sa.Column("notify_email", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("users", sa.Column("org_name", sa.String(200), nullable=True))
    op.add_column("users", sa.Column("org_description", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("org_logo", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("ngo_status", sa.String(20), nullable=True))
    op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT")
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE varchar(20) USING role::text")
    op.execute("UPDATE users SET role = 'admin' WHERE role IN ('adminofficer', 'officer', 'admin')")
    op.execute("DROP TYPE user_role")
    op.execute("CREATE TYPE user_role AS ENUM ('donor', 'recipient', 'ngo', 'admin')")
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role")
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'recipient'")
    _infer_district("users", "location")

    # ── food_listings: new columns, filled from the old free-text ones ───────
    cols = [
        sa.Column("district", sa.String(30), nullable=True),
        sa.Column("area", sa.String(120), nullable=True),
        sa.Column("pickup_address", sa.Text(), nullable=True),
        sa.Column("category", sa.String(30), nullable=False, server_default="other"),
        sa.Column("quantity_total", sa.Numeric(10, 2), nullable=True),
        sa.Column("quantity_available", sa.Numeric(10, 2), nullable=True),
        sa.Column("unit", sa.String(20), nullable=False, server_default="portions"),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("prepared_at", sa.DateTime(), nullable=True),
        sa.Column("fulfilment", sa.String(10), nullable=False, server_default="pickup"),
        sa.Column("images", sa.dialects.postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("safety_confirmed", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    ]
    for c in cols:
        op.add_column("food_listings", c)
    op.execute("ALTER TABLE food_listings ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TABLE food_listings ALTER COLUMN status TYPE varchar(20) USING status::text")
    op.execute(f"""
        UPDATE food_listings SET
          quantity_total = COALESCE(NULLIF(substring(quantity from '{_QTY_NUMBER}')::numeric, 0), 1),
          unit = left(COALESCE(NULLIF(lower(trim(regexp_replace(quantity, '^\\s*[0-9.]+\\s*', ''))), ''), 'portions'), 20),
          area = location,
          pickup_address = location,
          expires_at = CASE WHEN expiry_date ~ '^[0-9]{{4}}-[0-9]{{2}}-[0-9]{{2}}$'
                            THEN expiry_date::date + time '23:59'
                            ELSE created_at + interval '1 day' END,
          images = CASE WHEN image_path IS NOT NULL THEN ARRAY[image_path] ELSE '{{}}'::text[] END,
          category = CASE
              WHEN food_name ~* '(bread|bun|roll|cake|pastr|loaf|loaves|biscuit)' THEN 'bakery'
              WHEN food_name ~* '(rice|dhal|dal|lentil|flour|grain|noodle|pasta)' AND food_name !~* 'curry' THEN 'rice_grains'
              WHEN food_name ~* '(curry|meal|lunch|dinner|buffet|kottu|biriyani|cooked)' THEN 'cooked_meals'
              WHEN food_name ~* '(vegetable|fruit|banana|mango|carrot|leaf|leaves|tomato|potato)' THEN 'vegetables_fruits'
              WHEN food_name ~* '(milk|yogurt|curd|cheese|egg)' THEN 'dairy_eggs'
              WHEN food_name ~* '(juice|drink|water|tea|coffee)' THEN 'beverages'
              WHEN food_name ~* '(packet|packed|canned|tin|sweet)' THEN 'packaged'
              ELSE 'other' END,
          updated_at = created_at
    """)
    _infer_district("food_listings", "location")
    op.execute("UPDATE food_listings f SET district = u.district FROM users u WHERE f.district IS NULL AND u.id = f.donor_id")
    op.execute("UPDATE food_listings SET district = 'Colombo' WHERE district IS NULL")

    # ── food_requests: listing-less rows (the old open needs board) leave; the rest convert ──
    op.execute("UPDATE feedback SET request_id = NULL WHERE request_id IN (SELECT id FROM food_requests WHERE listing_id IS NULL)")
    op.execute("DELETE FROM food_requests WHERE listing_id IS NULL")
    op.add_column("food_requests", sa.Column("quantity_requested", sa.Numeric(10, 2), nullable=True))
    op.add_column("food_requests", sa.Column("message", sa.Text(), nullable=True))
    op.add_column("food_requests", sa.Column("decline_reason", sa.Text(), nullable=True))
    op.add_column("food_requests", sa.Column("responded_at", sa.DateTime(), nullable=True))
    op.add_column("food_requests", sa.Column("collected_at", sa.DateTime(), nullable=True))
    op.add_column("food_requests", sa.Column("completed_at", sa.DateTime(), nullable=True))
    op.execute("ALTER TABLE food_requests ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TABLE food_requests ALTER COLUMN status TYPE varchar(20) USING status::text")
    op.execute(f"""
        UPDATE food_requests r SET
          quantity_requested = LEAST(COALESCE(NULLIF(substring(r.quantity from '{_QTY_NUMBER}')::numeric, 0), l.quantity_total), l.quantity_total),
          message = r.description,
          status = CASE r.status
              WHEN 'quality_checked' THEN 'accepted' WHEN 'delivering' THEN 'accepted'
              WHEN 'delivered' THEN 'completed' WHEN 'picked_up' THEN 'completed' ELSE r.status END
        FROM food_listings l WHERE l.id = r.listing_id
    """)
    op.execute("UPDATE food_requests SET responded_at = COALESCE(updated_at, created_at) WHERE status <> 'pending'")
    op.execute("UPDATE food_requests SET completed_at = COALESCE(updated_at, created_at) WHERE status = 'completed'")

    # ── food_listings: stock and status from the converted requests ──────────
    op.execute("""
        UPDATE food_listings l SET quantity_available = GREATEST(l.quantity_total - COALESCE(
            (SELECT SUM(r.quantity_requested) FROM food_requests r
              WHERE r.listing_id = l.id AND r.status IN ('pending', 'accepted', 'collected', 'completed')), 0), 0)
    """)
    op.execute("""
        UPDATE food_listings SET status = CASE
            WHEN verification_status = 'rejected' THEN 'closed'
            WHEN expires_at < (now() AT TIME ZONE 'Asia/Colombo') THEN 'expired'
            WHEN quantity_available <= 0 THEN 'sold_out'
            ELSE 'active' END
    """)
    # an expired listing returns the stock its unanswered requests held
    op.execute("""
        UPDATE food_requests r SET status = 'expired', responded_at = now()
        FROM food_listings l WHERE l.id = r.listing_id AND l.status IN ('expired', 'closed') AND r.status = 'pending'
    """)
    op.execute("""
        UPDATE food_listings l SET quantity_available = GREATEST(l.quantity_total - COALESCE(
            (SELECT SUM(r.quantity_requested) FROM food_requests r
              WHERE r.listing_id = l.id AND r.status IN ('pending', 'accepted', 'collected', 'completed')), 0), 0)
    """)
    for col in ("quantity_total", "quantity_available", "expires_at", "district"):
        op.alter_column("food_listings", col, nullable=False)
    for col in ("quantity", "expiry_date", "location", "contact_email", "image_path", "accepted_by",
                "requested_by", "verification_status", "rejection_reason"):
        op.drop_column("food_listings", col)
    op.execute("DROP TYPE listing_status")
    op.execute("CREATE TYPE listing_status AS ENUM ('active', 'sold_out', 'expired', 'closed')")
    op.execute("ALTER TABLE food_listings ALTER COLUMN status TYPE listing_status USING status::listing_status")
    op.execute("ALTER TABLE food_listings ALTER COLUMN status SET DEFAULT 'active'")
    op.create_check_constraint("ck_listing_stock", "food_listings",
                               "quantity_available >= 0 AND quantity_available <= quantity_total")
    op.create_index("ix_food_listings_district", "food_listings", ["district"])
    op.create_index("ix_food_listings_status_expires", "food_listings", ["status", "expires_at"])

    # ── food_requests: drop the old free-text fields, enforce the listing ────
    for col in ("food_name", "quantity", "needed_by", "location", "description", "image_path", "accepted_by"):
        op.drop_column("food_requests", col)
    op.alter_column("food_requests", "listing_id", nullable=False)
    op.alter_column("food_requests", "quantity_requested", nullable=False)
    op.execute("DROP TYPE request_status")
    op.execute("CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled', "
               "'collected', 'completed', 'no_show', 'expired')")
    op.execute("ALTER TABLE food_requests ALTER COLUMN status TYPE request_status USING status::request_status")
    op.execute("ALTER TABLE food_requests ALTER COLUMN status SET DEFAULT 'pending'")
    op.create_check_constraint("ck_request_quantity", "food_requests", "quantity_requested > 0")

    # ── reports (replace escalations) ────────────────────────────────────────
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reporter_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_reports_status", "reports", ["status"])
    op.create_index("ix_reports_target", "reports", ["target_type", "target_id"])
    op.execute("""
        INSERT INTO reports (reporter_id, target_type, target_id, reason, status, admin_note, created_at, updated_at)
        SELECT raised_by, target_type, target_id, reason, status, admin_note, created_at, updated_at FROM escalations
    """)
    op.drop_table("escalations")
    op.drop_table("money_donations")

    # ── notifications, ratings ───────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("link", sa.String(200), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )
    op.create_index("ix_notifications_user", "notifications", ["user_id", "is_read", "created_at"])
    op.create_table(
        "ratings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("request_id", sa.Integer(), sa.ForeignKey("food_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rater_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ratee_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.SmallInteger(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.CheckConstraint("score BETWEEN 1 AND 5", name="ck_rating_score"),
        sa.UniqueConstraint("request_id", "rater_id", name="uq_rating_once"),
    )
    op.create_index("ix_ratings_ratee", "ratings", ["ratee_id"])

    # ── community events: NGO-owned, typed, per district ─────────────────────
    op.alter_column("community_events", "created_by", new_column_name="owner_id")
    op.add_column("community_events", sa.Column("event_type", sa.String(20), nullable=False, server_default="other"))
    op.add_column("community_events", sa.Column("district", sa.String(30), nullable=True))
    op.add_column("community_events", sa.Column("images", sa.dialects.postgresql.ARRAY(sa.Text()),
                                                nullable=False, server_default="{}"))
    op.add_column("community_events", sa.Column("contact_name", sa.String(120), nullable=True))
    op.add_column("community_events", sa.Column("contact_phone", sa.String(20), nullable=True))
    op.add_column("community_events", sa.Column("contact_email", sa.String(255), nullable=True))
    op.add_column("community_events", sa.Column("status", sa.String(12), nullable=False, server_default="published"))
    _infer_district("community_events", "location")
    op.execute("UPDATE community_events SET district = 'Colombo' WHERE district IS NULL")
    op.alter_column("community_events", "district", nullable=False)
    op.create_index("ix_community_events_district", "community_events", ["district"])


def downgrade() -> None:
    # ── events ───────────────────────────────────────────────────────────────
    op.drop_index("ix_community_events_district", table_name="community_events")
    for col in ("status", "contact_email", "contact_phone", "contact_name", "images", "district", "event_type"):
        op.drop_column("community_events", col)
    op.alter_column("community_events", "owner_id", new_column_name="created_by")

    op.drop_table("ratings")
    op.drop_table("notifications")

    # ── escalations / money donations come back from the snapshot ────────────
    op.create_table(
        "escalations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("raised_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_escalations_raised_by", "escalations", ["raised_by"])
    op.create_table(
        "money_donations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("card_last4", sa.String(4), nullable=True),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("payment_ref", sa.String(64), unique=True, nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )
    op.create_index("ix_money_donations_email", "money_donations", ["email"])
    op.execute("""INSERT INTO escalations (id, raised_by, target_type, target_id, reason, status, admin_note, created_at, updated_at)
                  SELECT id, raised_by, target_type, target_id, reason, status, admin_note, created_at, updated_at
                  FROM legacy_v1_escalations""")
    op.execute("""INSERT INTO money_donations (id, name, email, amount, card_last4, source, payment_ref, created_at)
                  SELECT id, name, email, amount, card_last4, source, payment_ref, created_at FROM legacy_v1_money_donations""")
    op.drop_table("reports")

    # ── food_requests ────────────────────────────────────────────────────────
    op.drop_constraint("ck_request_quantity", "food_requests")
    op.execute("ALTER TABLE food_requests ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TABLE food_requests ALTER COLUMN status TYPE varchar(20) USING status::text")
    op.execute("DROP TYPE request_status")
    op.execute("CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'declined', 'quality_checked', "
               "'delivering', 'delivered', 'picked_up', 'cancelled')")
    op.add_column("food_requests", sa.Column("food_name", sa.String(255), nullable=True))
    op.add_column("food_requests", sa.Column("quantity", sa.String(100), nullable=True))
    op.add_column("food_requests", sa.Column("needed_by", sa.String(20), nullable=True))
    op.add_column("food_requests", sa.Column("location", sa.String(255), nullable=True))
    op.add_column("food_requests", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("food_requests", sa.Column("image_path", sa.String(500), nullable=True))
    op.add_column("food_requests", sa.Column("accepted_by", sa.String(255), nullable=True))
    op.alter_column("food_requests", "listing_id", nullable=True)
    # rows that existed before: take their original text fields back; newer rows get sensible ones
    op.execute("""
        UPDATE food_requests r SET food_name = o.food_name, quantity = o.quantity, needed_by = o.needed_by,
               location = o.location, description = o.description, image_path = o.image_path,
               accepted_by = o.accepted_by
        FROM legacy_v1_food_requests o WHERE o.id = r.id
    """)
    op.execute("""
        UPDATE food_requests r SET food_name = l.food_name,
               quantity = trim(trailing '.' FROM trim(trailing '0' FROM r.quantity_requested::text)) || ' ' || l.unit,
               description = r.message
        FROM food_listings l WHERE l.id = r.listing_id AND r.food_name IS NULL
    """)
    # original fine-grained status when the new one is still its equivalent, otherwise the closest old one
    op.execute("""
        UPDATE food_requests r SET status = COALESCE(
            (SELECT o.status FROM legacy_v1_food_requests o
              WHERE o.id = r.id AND CASE o.status
                    WHEN 'quality_checked' THEN 'accepted' WHEN 'delivering' THEN 'accepted'
                    WHEN 'delivered' THEN 'completed' WHEN 'picked_up' THEN 'completed' ELSE o.status END = r.status),
            CASE r.status WHEN 'completed' THEN 'delivered' WHEN 'collected' THEN 'picked_up'
                 WHEN 'no_show' THEN 'cancelled' WHEN 'expired' THEN 'cancelled' ELSE r.status END)
    """)
    op.execute("ALTER TABLE food_requests ALTER COLUMN status TYPE request_status USING status::request_status")
    op.execute("ALTER TABLE food_requests ALTER COLUMN status SET DEFAULT 'pending'")
    op.alter_column("food_requests", "food_name", nullable=False)
    op.alter_column("food_requests", "quantity", nullable=False)
    for col in ("completed_at", "collected_at", "responded_at", "decline_reason", "message", "quantity_requested"):
        op.drop_column("food_requests", col)

    # ── food_listings ────────────────────────────────────────────────────────
    op.drop_constraint("ck_listing_stock", "food_listings")
    op.drop_index("ix_food_listings_status_expires", table_name="food_listings")
    op.drop_index("ix_food_listings_district", table_name="food_listings")
    op.execute("ALTER TABLE food_listings ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TABLE food_listings ALTER COLUMN status TYPE varchar(20) USING status::text")
    op.execute("DROP TYPE listing_status")
    op.execute("CREATE TYPE listing_status AS ENUM ('available', 'requested', 'accepted', 'reserved', "
               "'picked_up', 'completed', 'cancelled')")
    op.add_column("food_listings", sa.Column("quantity", sa.String(100), nullable=True))
    op.add_column("food_listings", sa.Column("expiry_date", sa.String(20), nullable=True))
    op.add_column("food_listings", sa.Column("location", sa.String(255), nullable=True))
    op.add_column("food_listings", sa.Column("contact_email", sa.String(255), nullable=True))
    op.add_column("food_listings", sa.Column("image_path", sa.String(500), nullable=True))
    op.add_column("food_listings", sa.Column("accepted_by", sa.String(255), nullable=True))
    op.add_column("food_listings", sa.Column("requested_by", sa.Integer(), nullable=True))
    op.add_column("food_listings", sa.Column("verification_status", sa.String(20), nullable=False,
                                             server_default="pending_review"))
    op.add_column("food_listings", sa.Column("rejection_reason", sa.Text(), nullable=True))
    op.execute("""
        UPDATE food_listings l SET
          quantity = trim(trailing '.' FROM trim(trailing '0' FROM l.quantity_total::text)) || ' ' || l.unit,
          expiry_date = to_char(l.expires_at, 'YYYY-MM-DD'),
          location = COALESCE(l.area, l.district),
          image_path = l.images[1],
          verification_status = 'approved'
    """)
    op.execute("""
        UPDATE food_listings l SET quantity = o.quantity, expiry_date = o.expiry_date, location = o.location,
               contact_email = o.contact_email, accepted_by = o.accepted_by, requested_by = o.requested_by,
               verification_status = o.verification_status, rejection_reason = o.rejection_reason
        FROM legacy_v1_food_listings o WHERE o.id = l.id
    """)
    op.execute("""
        UPDATE food_listings l SET status = COALESCE(
            (SELECT o.status FROM legacy_v1_food_listings o WHERE o.id = l.id),
            CASE l.status WHEN 'closed' THEN 'cancelled' WHEN 'expired' THEN 'cancelled' ELSE 'available' END)
    """)
    op.execute("ALTER TABLE food_listings ALTER COLUMN status TYPE listing_status USING status::listing_status")
    op.execute("ALTER TABLE food_listings ALTER COLUMN status SET DEFAULT 'available'")
    op.alter_column("food_listings", "quantity", nullable=False)
    for col in ("updated_at", "safety_confirmed", "images", "fulfilment", "prepared_at", "expires_at", "unit",
                "quantity_available", "quantity_total", "category", "pickup_address", "area", "district"):
        op.drop_column("food_listings", col)

    # the old open-board requests (no listing) come back with their original data
    op.execute("""
        INSERT INTO food_requests (id, recipient_id, food_name, quantity, needed_by, location, description, image_path,
                                   listing_id, status, accepted_by, created_at, updated_at)
        SELECT id, recipient_id, food_name, quantity, needed_by, location, description, image_path,
               listing_id, status::request_status, accepted_by, created_at, updated_at
        FROM legacy_v1_food_requests WHERE listing_id IS NULL
    """)
    op.execute("SELECT setval(pg_get_serial_sequence('food_requests', 'id'), "
               "GREATEST((SELECT COALESCE(MAX(id), 1) FROM food_requests), 1))")

    # ── users ────────────────────────────────────────────────────────────────
    op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT")
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE varchar(20) USING role::text")
    op.execute("UPDATE users SET role = CASE role WHEN 'admin' THEN 'adminofficer' WHEN 'ngo' THEN 'recipient' ELSE role END")
    op.execute("DROP TYPE user_role")
    op.execute("CREATE TYPE user_role AS ENUM ('donor', 'recipient', 'officer', 'admin', 'adminofficer')")
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role")
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'recipient'")
    for col in ("ngo_status", "org_logo", "org_description", "org_name", "notify_email",
                "notify_food_types", "notify_districts", "district"):
        op.drop_column("users", col)
