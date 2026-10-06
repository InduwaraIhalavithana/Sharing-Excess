import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.utils import events

router = APIRouter(prefix="/api", tags=["live"])

HEARTBEAT_SECONDS = 25


@router.get("/events")
async def stream(request: Request):
    """Server-Sent Events: one `data: {"topic": ...}` line whenever listings, requests or
    feedback change. Browsers reconnect automatically if the connection drops."""
    queue = events.subscribe()

    async def gen():
        try:
            yield "retry: 3000\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
                    yield f"data: {message}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"  # keeps proxies from closing an idle stream
        finally:
            events.unsubscribe(queue)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
