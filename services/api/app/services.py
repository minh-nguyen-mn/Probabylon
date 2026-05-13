import json

import redis.asyncio as redis

from app.core.config import settings
from app.llm.providers import LLMProviderError, get_provider
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


async def estimate_initial_probability(question: str, description: str, resolution_criteria: str) -> float:
    try:
        provider = get_provider(settings.default_llm_provider)
        prompt = (
            "Estimate a calibrated prior probability for a fresh binary prediction market.\n"
            "Return strict JSON with keys probability and rationale.\n"
            f"Question: {question}\n"
            f"Description: {description}\n"
            f"Resolution criteria: {resolution_criteria}\n"
            "Use a neutral prior when evidence is weak. Keep the probability inside [0.05, 0.95]."
        )
        raw = await provider.generate(
            "You estimate initial market priors for a prediction platform.",
            prompt,
            0.2,
            220,
        )
        start = raw.find("{")
        end = raw.rfind("}")
        data = json.loads(raw[start : end + 1])
        probability = float(data.get("probability", 0.5))
        return max(0.05, min(0.95, probability))
    except (ValueError, KeyError, TypeError, json.JSONDecodeError, LLMProviderError):
        return 0.5
