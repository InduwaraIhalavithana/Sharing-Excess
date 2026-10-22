Good food is thrown away every day while people nearby go without. I built Sharing Excess to close that gap: a web platform for Sri Lanka that gets surplus food from the person who has it to the person who needs it.

Here is a walkthrough of every role: visitor, donor, recipient, NGO and admin. All data in the video is demo data.

**How it works**
- Donors post food with photos, quantity, expiry time and a "safe and not expired" confirmation. It goes live straight away.
- Recipients and approved NGOs see food from their own district first, then neighbouring districts, then the rest.
- Requesting holds that quantity under a database row lock, so two people can never be promised the same food. It returns if the donor declines, someone cancels, or the listing expires.
- The donor accepts or declines (a decline needs a reason). Phone and address are shared only after acceptance, and only with that one person.
- Both sides rate each other after the handover. Anyone can report a listing; one admin approves NGOs and moderates.

**Under the hood**
- React 19 + TypeScript front end, FastAPI + PostgreSQL back end, Alembic migrations
- Live updates over Server-Sent Events, English / Sinhala / Tamil, light/dark mode, responsive down to 320 px
- 187 backend and 58 front-end automated tests, GitHub Actions CI, and a Docker Compose stack I checked from an empty database
- Testing in a real browser turned up bugs I fixed: a crash on a badly formatted phone number, case-sensitive emails, and time-zone errors on event times

**Honest notes:** it is a university final-year project and is not hosted publicly yet, so there is no live link. There is no food-safety inspection either. Safety rests on the donor's confirmation, photos, expiry times, reports and admin removal.

Code and README with screenshots: https://github.com/InduwaraIhalavithana/Sharing-Excess

#FoodWaste #SriLanka #FullStack #React #FastAPI #PostgreSQL #SoftwareEngineering
