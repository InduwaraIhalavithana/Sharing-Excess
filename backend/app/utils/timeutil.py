from datetime import datetime
from zoneinfo import ZoneInfo

COLOMBO = ZoneInfo("Asia/Colombo")


def now_colombo() -> datetime:
    """Listing and event times are stored as Sri Lanka wall-clock time (naive), so compare with the same."""
    return datetime.now(COLOMBO).replace(tzinfo=None)
