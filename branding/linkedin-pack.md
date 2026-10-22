# Sharing Excess - LinkedIn pack

Built 2026-10-21 after the demo take. Every claim below was checked against the repo, the test runs or the recording session; items marked (decide) are yours to choose.

## 1. Video title
Sharing Excess: surplus food, shared with the people nearby (full-stack demo)

## 2. Main post (1932 characters)
Good food is thrown away every day while people nearby go without. I built Sharing Excess to close that gap: a web platform for Sri Lanka that gets surplus food from the person who has it to the person who needs it.

Here is a walkthrough of every role: visitor, donor, recipient, NGO and admin. All data in the video is demo data.

How it works
- Donors post food with photos, quantity, expiry time and a "safe and not expired" confirmation. It goes live straight away.
- Recipients and approved NGOs see food from their own district first, then neighbouring districts, then the rest.
- Requesting holds that quantity under a database row lock, so two people can never be promised the same food. It returns if the donor declines, someone cancels, or the listing expires.
- The donor accepts or declines (a decline needs a reason). Phone and address are shared only after acceptance, and only with that one person.
- Both sides rate each other after the handover. Anyone can report a listing; one admin approves NGOs and moderates.

Under the hood
- React 19 + TypeScript front end, FastAPI + PostgreSQL back end, Alembic migrations
- Live updates over Server-Sent Events, English / Sinhala / Tamil, light/dark mode, responsive down to 320 px
- 187 backend and 58 front-end automated tests, GitHub Actions CI, and a Docker Compose stack I checked from an empty database
- Testing in a real browser turned up bugs I fixed: a crash on a badly formatted phone number, case-sensitive emails, and time-zone errors on event times

Honest notes: it is a university final-year project and is not hosted publicly yet, so there is no live link. There is no food-safety inspection either. Safety rests on the donor's confirmation, photos, expiry times, reports and admin removal.

Code and README with screenshots: github.com/InduwaraIhalavithana/Sharing-Excess

#FoodWaste #SriLanka #FullStack #React #FastAPI #PostgreSQL #SoftwareEngineering

## 3. Short post (424 characters)
New demo: Sharing Excess, a food-sharing platform for Sri Lanka. Donors post surplus food, people nearby see it first, a request holds the stock so nothing is promised twice, and contact details are shared only after the donor accepts. React + FastAPI + PostgreSQL, 245 automated tests, English / Sinhala / Tamil. Demo data in the video.

Code: github.com/InduwaraIhalavithana/Sharing-Excess

#FoodWaste #SriLanka #FullStack

## 4. First comment
Code, README and screenshots: https://github.com/InduwaraIhalavithana/Sharing-Excess

Stack: React 19, TypeScript, Vite, TanStack Query, React Hook Form + Zod, Leaflet and Chart.js on the front end; FastAPI, SQLAlchemy 2, Alembic, Pillow and PostgreSQL on the back end; Docker Compose and GitHub Actions for delivery.

Happy to talk about how the stock is held under a row lock, or how the nearest-district ordering works.

## 5. Projects entry (LinkedIn > Add profile section > Projects)
- Project name: Sharing Excess
- Dates: Jul 2026 - Oct 2026 (first commit 6 Jul 2026, latest 21 Oct 2026)
- Associated with: Uva Wellassa University (per the README: final-year project)
- Project URL: https://github.com/InduwaraIhalavithana/Sharing-Excess
- Description:
Web platform that moves surplus food from donors to nearby recipients and approved NGOs in Sri Lanka. Listings are ordered by district (same district, then neighbouring districts, then the rest) and a request holds the quantity under a database row lock so food is never promised twice. Contact details are shared only after the donor accepts. Includes ratings both ways, reports, NGO events, one admin for approvals and moderation, live updates, English / Sinhala / Tamil and light/dark mode. Four roles: donor, recipient, NGO, admin. 187 backend and 58 front-end tests, GitHub Actions CI, Docker Compose.
- Skills: React, TypeScript, Python, FastAPI, PostgreSQL, SQLAlchemy, Alembic, REST APIs, Docker, GitHub Actions, pytest, Vitest, Responsive Web Design, Internationalization (i18n)

## 6. Alt text
- Thumbnail: "Sharing Excess: Nearest first. No food wasted. A listing card for rice and curry packets in Galle with 10 of 40 packets left, and the labels Stock held, Live updates, 3 languages and 4 roles. React, TypeScript, FastAPI, PostgreSQL, Docker."
- Video description (for captions/accessibility): "Screen recording of the Sharing Excess web app: a visitor browsing food near them, then a donor, a recipient, an NGO and the admin each using their own dashboard. All data shown is demo data."

## 7. Verified facts used (and where they come from)
| Claim | Source |
|---|---|
| 187 backend + 58 front-end tests, CI green | pytest / vitest runs on 2026-10-21; GitHub Actions on master |
| 9 migrations, 69 API routes, 69 commits, 11 merged PRs | repo on 2026-10-21 |
| Docker Compose stack starts from an empty database | `docker compose up` verified 2026-10-20 |
| Responsive down to 320 px | 62 page views checked at 320 and 390 px |
| English / Sinhala / Tamil, live updates (SSE), light/dark | README + checked in the app |
| Bugs found and fixed (phone-number crash, email case, event time zones) | PR #10 |
| Not hosted publicly | no deployment exists; the README has no live URL |
| Final-year project at Uva Wellassa University | README |

## 8. Checklist before posting
- [ ] Trim the OBS start/stop in Clipchamp. The Claude extension's indicator bar and orange cursor marker are not part of the app; trim or crop them if they bother you.
- [ ] The raw take is about 4 min 25 s (retake). Say the real length if you mention it.
- [ ] Upload branding/sharingexcess-demo-thumbnail.png as the video thumbnail (1920x1080).
- [ ] Put the video title from section 1 on the upload.
- [ ] Paste the main post; keep "All data in the video is demo data".
- [ ] Post the first comment right after publishing and pin it.
- [ ] Add the Projects entry (section 5).
- [ ] (decide) Mention that you built it with Claude Code as a pair programmer, if that is true to how you want to present it.
- [ ] (decide) Tag Uva Wellassa University.
- [ ] Do not add a live link, user numbers or "deployed" wording: none of that is true yet.
- [x] Demo data removed and services stopped on 2026-10-21 (backup: backups/sharing_excess_2026-10-21_before-demo-removal.dump).
