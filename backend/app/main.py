import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.database import engine
from app.routers import auth, calendar, contact, donations, feedback, listings, live, officer, public, requests
from app.utils import events
from app.utils.limiter import limiter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_migrations() -> None:
    """Bring the database up to the latest schema (Alembic).

    A database created before Alembic was introduced already has the tables but no
    version stamp - mark it as the baseline first so nothing is re-created.
    """
    from alembic.config import Config
    from sqlalchemy import inspect

    from alembic import command

    root = Path(__file__).resolve().parents[1]
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "alembic"))
    tables = set(inspect(engine).get_table_names())
    if "users" in tables and "alembic_version" not in tables:
        command.stamp(cfg, "0001")
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    logger.info("Database schema is up to date.")
    yield


cors_origins = settings.cors_origins

app = FastAPI(
    title="Sharing Excess API",
    description="Food redistribution platform for Sri Lanka",
    version="2.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.middleware("http")
async def announce_changes(request, call_next):
    """After any successful write to listings/requests/feedback, tell live clients to refetch."""
    response = await call_next(request)
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and response.status_code < 400:
        for prefix, topic in events.TOPICS:
            if request.url.path.startswith(prefix):
                events.publish(topic)
                break
    return response


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
app.include_router(public.router)
app.include_router(live.router)


@app.get("/")
def root():
    return {"message": "Sharing Excess API is running.", "docs": "/docs"}


@app.get("/health")
@app.get("/api/health")  # reachable through nginx too, for uptime checks
def health():
    return {"status": "ok"}
