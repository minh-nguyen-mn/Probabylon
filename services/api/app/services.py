import json

import redis.asyncio as redis

from app.core.config import settings
from worker.celery_app import celery_app


def enqueue_simulation(market_id: str, rounds: int, max_agents: int) -> str:
    task = celery_app.send_task(
        "worker.tasks.run_simulation",
        kwargs={"market_id": market_id, "rounds": rounds, "max_agents": max_agents},
    )
    return task.id


async def publish_market_event(payload: dict) -> None:
    client = redis.from_url(settings.redis_url)
    await client.publish("probabylon.market.events", json.dumps(payload))
    await client.close()
