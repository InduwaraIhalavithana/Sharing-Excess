import os

from slowapi import Limiter
from slowapi.util import get_remote_address

# Tests switch this off (RATE_LIMIT_ENABLED=false) so they can hammer /login freely.
limiter = Limiter(
    key_func=get_remote_address,
    enabled=os.getenv("RATE_LIMIT_ENABLED", "true").lower() != "false",
)
