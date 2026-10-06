# Sharing Excess: redesign plan (decided 2026-10-06)

## The idea
Donors post surplus food, recipients near them see it first, request all or part of it, and the donor accepts or declines
(with a reason). On acceptance the donor's contact details are shared so the two can arrange pickup or delivery.
NGOs post events. Guests can browse listings and events. One admin account does admin work only: no food-quality checks,
no supervision of handovers.

## Decisions (answered by the owner)
1. **Closest** = recipient's district first, then neighbouring districts, then the rest. Every profile and listing has a district.
2. **Stock** is held when a request is made. It returns if the donor declines, the recipient cancels, or the listing expires.
3. **Notifications** = in-app bell + email, filtered by each recipient's chosen districts and food types.
4. **NGOs** have their own account type, approved by the admin. They post events, appear in the NGO directory, and can also request food.
5. **Contact details** are hidden from everyone until the donor accepts; then only that recipient sees them. Guests see district and area only, never exact addresses.
6. **Ratings** both ways after a handover is marked completed (recipient rates donor, donor rates recipient), plus the feedback form to the admin.
7. **Money donations (PayHere)** are removed.
8. **Existing data is migrated** (officer becomes the single admin, approved listings go live, sample NGOs replaced by real NGO accounts). Back up the database first.

## Assumptions (change if wrong)
- The old "open needs board" (a recipient posting a request with no listing) is removed; notifications replace it.
- A listing can have up to 3 photos; at least 1 is required.
- Roles become: donor, recipient, ngo, admin (officer and adminofficer are removed).
- Listings go live immediately. The donor ticks "I confirm this food is safe and not expired"; anyone can Report a post.

## Phases
**0. Safety:** commit the finished UI work on its branch, branch off for this work, `pg_dump` the `sharing_excess` database, record the baseline test results.

**1. Database (Alembic migration + models)**
- users: district, notification preferences (districts, food types, email on/off), NGO fields (organisation name, description, logo, approval status), role values.
- food_listings: district, area, category, numeric `quantity_total` and `quantity_available`, unit, `expires_at` (date and time), prepared_at (cooked food), pickup or delivery, up to 3 images, status (active, sold_out, expired, closed). Remove the verification fields.
- food_requests: listing required, `quantity_requested`, message, status (pending, accepted, declined, cancelled, collected, completed, no_show, expired), decline_reason, timestamps.
- New: notifications, ratings, reports (replaces escalations).
- community_events: type, district, images, contact name/phone/email, owner NGO, status.
- Drop: money_donations and the PayHere routes.
- Data migration for officer, listings, requests and sample NGOs, with a rollback path.

**2. Backend (FastAPI)**
- Listings: create immediately; district filter and priority ordering; search; expiry handling.
- Requests: partial quantity, stock held with a row lock in one transaction, accept/decline (reason required), cancel returns stock, contact revealed only on accept, handover statuses.
- Notifications service (bell + email, respecting preferences) for new matching listings, request updates and new events.
- Ratings, reports, NGO events (create/edit/delete own), NGO approval and moderation for the admin, simple admin stats.
- Public endpoints for guests strip contact details and exact addresses.
- Tests for all of it, especially stock accounting and privacy.

**3. Frontend (React)**
- Post-food form (images, description, category, quantity + unit, district + area, expiry date and time, pickup/delivery, safety tick).
- Browse with nearby-first ordering, filters and search; listing detail with a request form (quantity stepper showing what remains).
- Donor dashboard (my listings and stock, incoming requests with accept/decline + reason, mark collected/completed).
- Recipient dashboard (nearby feed, my requests, notification bell, preferences).
- NGO dashboard, event form with images, real NGO directory, events page with type and district filters.
- Ratings UI; single-admin dashboard (users, NGO approvals, reports, feedback, stats).
- All new text in English, Sinhala and Tamil; remove the money-donation pages.

**4. Verification:** backend and frontend tests, a full walkthrough of every role in Chrome (guest, donor, recipient, NGO, admin), light and dark mode, three languages, phone and desktop widths; update the README.

## Order of work
Build and test phases 0 to 2 first (backend), check in, then phase 3 page by page, then phase 4.
