"""Tiny in-process pub/sub for live updates (Server-Sent Events).

Only "something changed" signals travel through here - never record data - so the
stream can be public. It lives in one process: run a single uvicorn worker, or swap
this for Redis pub/sub if the app is ever scaled out.
"""
import asyncio
import json

_subscribers: set[asyncio.Queue] = set()
MAX_PENDING = 50  # a stuck client never grows memory without bound


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=MAX_PENDING)
    _subscribers.add(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    _subscribers.discard(q)


def publish(topic: str) -> None:
    """Tell every connected client that `topic` ('listings', 'requests', 'feedback') changed."""
    message = json.dumps({"topic": topic})
    for q in list(_subscribers):
        try:
            q.put_nowait(message)
        except asyncio.QueueFull:
            pass  # that client will refetch on its next signal anyway


def subscriber_count() -> int:
    return len(_subscribers)


# Which write endpoints change which topic
TOPICS = (
    ("/api/listings", "listings"),
    ("/api/officer/listings", "listings"),
    ("/api/requests", "requests"),
    ("/api/officer/requests", "requests"),
    ("/api/feedback", "feedback"),
    ("/api/officer/feedback", "feedback"),
)
