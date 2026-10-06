"""Live-update signals: a successful write publishes a topic; reads and failures do not."""
import asyncio

from app.utils import events


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def drain(q: asyncio.Queue) -> list[str]:
    out = []
    while not q.empty():
        out.append(q.get_nowait())
    return out


class TestBroadcaster:
    def test_publish_reaches_every_subscriber(self):
        a, b = events.subscribe(), events.subscribe()
        try:
            events.publish("listings")
            assert drain(a) == ['{"topic": "listings"}'] == drain(b)
        finally:
            events.unsubscribe(a)
            events.unsubscribe(b)

    def test_a_stuck_client_does_not_block_or_grow_forever(self):
        q = events.subscribe()
        try:
            for _ in range(events.MAX_PENDING + 20):
                events.publish("requests")
            assert q.qsize() == events.MAX_PENDING
        finally:
            events.unsubscribe(q)

    def test_unsubscribe_cleans_up(self):
        before = events.subscriber_count()
        q = events.subscribe()
        events.unsubscribe(q)
        assert events.subscriber_count() == before


class TestWritesAnnounceChanges:
    def test_creating_a_request_publishes_requests(self, client, recipient_token):
        q = events.subscribe()
        try:
            res = client.post("/api/requests", headers=bearer(recipient_token),
                              data={"food_name": "Live Test", "quantity": "1"})
            assert res.status_code == 200
            assert '{"topic": "requests"}' in drain(q)
        finally:
            events.unsubscribe(q)

    def test_reads_and_failed_writes_publish_nothing(self, client, recipient_token):
        q = events.subscribe()
        try:
            client.get("/api/listings")
            client.post("/api/requests", data={"food_name": "x", "quantity": "1"})  # 401
            client.post("/api/requests", headers=bearer(recipient_token), data={"quantity": "1"})  # 422
            assert drain(q) == []
        finally:
            events.unsubscribe(q)
