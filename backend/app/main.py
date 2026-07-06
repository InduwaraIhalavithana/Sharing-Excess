import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base
from app.routers import auth, listings, requests, officer, calendar, feedback, contact, donations

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Add new columns to existing tables without dropping data
    from sqlalchemy import text
    with engine.connect() as conn:
        for sql in [
            "ALTER TABLE feedback ADD COLUMN IF NOT EXISTS admin_reply TEXT",
            "ALTER TABLE feedback ADD COLUMN IF NOT EXISTS feedback_status VARCHAR(10) NOT NULL DEFAULT 'open'",
            # Extend user_role enum to include officer (idempotent)
            "ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'officer'",
            # Migrate existing officers table rows into users (one-time, safe to re-run)
            """INSERT INTO users (name, email, password, role, status, created_at)
               SELECT name, email, password, 'officer',
                      CASE WHEN status = 'active' THEN 'active' ELSE 'suspended' END,
                      created_at
               FROM officers
               WHERE email NOT IN (SELECT email FROM users)""",
        ]:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                conn.rollback()
    logger.info("Database tables ready.")
    yield


CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5175")
cors_origins = [o.strip() for o in CORS_ORIGIN.split(",") if o.strip()]

app = FastAPI(
    title="Sharing Excess API",
    description="Food redistribution platform for Sri Lanka",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded images at /uploads/filename
UPLOADS_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Register routers
app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(requests.router)
app.include_router(officer.router)
app.include_router(calendar.router)
app.include_router(feedback.router)
app.include_router(contact.router)
app.include_router(donations.router)


@app.get("/")
def root():
    return {"message": "Sharing Excess API is running.", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
