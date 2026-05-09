from __future__ import annotations

import asyncio
import json
import logging
from typing import Protocol

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMProvider(Protocol):
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        ...


class LLMProviderError(RuntimeError):
    pass


def _normalize_model_name(provider: str, model: str) -> str:
    cleaned = (model or "").strip().strip("\"'")
    if cleaned.endswith(":free"):
        cleaned = cleaned.removesuffix(":free")
    if provider == "openrouter":
        aliases = {
            "deepseek-chat": "deepseek/deepseek-chat-v3-0324",
            "deepseek-r1": "deepseek/deepseek-r1",
            "deepseek/deepseek-chat": "deepseek/deepseek-chat-v3-0324",
        }
        cleaned = aliases.get(cleaned, cleaned)
        if not cleaned:
            return "deepseek/deepseek-chat-v3-0324"
    return cleaned


async def _request_json(
    url: str,
    headers: dict[str, str],
    payload: dict,
    timeout: float = 60.0,
    retries: int = 3,
) -> dict:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=15.0), follow_redirects=True) as client:
                response = await client.post(url, headers=headers, json=payload)
            if response.status_code >= 400:
                error_body = response.text[:1000]
                try:
                    error_json = response.json()
                except json.JSONDecodeError:
                    error_json = None
                logger.warning(
                    "LLM request failed: provider_url=%s attempt=%s status=%s model=%s error=%s",
                    url,
                    attempt,
                    response.status_code,
                    payload.get("model"),
                    error_json or error_body,
                )
                response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt == retries:
                break
            await asyncio.sleep(0.75 * attempt)
    raise LLMProviderError(f"LLM request failed after {retries} attempts: {last_error}")


def _extract_chat_content(data: dict) -> str:
    if data.get("choices"):
        message = data["choices"][0].get("message", {})
        content = message.get("content", "")
        if isinstance(content, list):
            return "\n".join(part.get("text", "") for part in content if isinstance(part, dict))
        return str(content)
    if data.get("content"):
        blocks = data["content"]
        return "\n".join(block.get("text", "") for block in blocks if isinstance(block, dict))
    raise LLMProviderError(f"Unexpected LLM response shape: {data}")


class OpenRouterProvider:
    async def generate(self, system_prompt: str, user_prompt: str, temperature: float, max_tokens: int) -> str:
        if not settings.openrouter_api_key:
            raise LLMProviderError("OpenRouter API key is missing. Set OPENROUTER_API_KEY to enable real agent reasoning.")
        model = _normalize_model_name("openrouter", settings.default_llm_model)
        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "HTTP-Referer": "https://probabylon.local",
            "X-Title": "Probabylon",
            "User-Agent": "Probabylon/1.0",
        }
        payload = {
            "model": model,
            "temperature": temperature,
            "max_completion_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        try:
            data = await _request_json("https://openrouter.ai/api/v1/chat/completions", headers, payload)
            return _extract_chat_content(data)
        except LLMProviderError as exc:
            logger.error("OpenRouter completion failed for model=%s: %s", model, exc)
            raise


class OpenAIProvider:
    async def generate(self, system_prompt: str, user_prompt: str, temperature: float, max_tokens: int) -> str:
        headers = {"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"}
        payload = {
            "model": settings.default_llm_model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        base_url = (settings.openai_base_url or "https://api.openai.com/v1").rstrip("/")
        data = await _request_json(f"{base_url}/chat/completions", headers, payload)
        return _extract_chat_content(data)


class AnthropicProvider:
    async def generate(self, system_prompt: str, user_prompt: str, temperature: float, max_tokens: int) -> str:
        headers = {
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.default_llm_model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        }
        data = await _request_json("https://api.anthropic.com/v1/messages", headers, payload)
        return _extract_chat_content(data)


class GroqProvider:
    async def generate(self, system_prompt: str, user_prompt: str, temperature: float, max_tokens: int) -> str:
        headers = {"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"}
        payload = {
            "model": settings.default_llm_model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        data = await _request_json("https://api.groq.com/openai/v1/chat/completions", headers, payload)
        return _extract_chat_content(data)


def get_provider(name: str) -> LLMProvider:
    providers: dict[str, LLMProvider] = {
        "openrouter": OpenRouterProvider(),
        "openai": OpenAIProvider(),
        "anthropic": AnthropicProvider(),
        "groq": GroqProvider(),
    }
    if name not in providers:
        raise LLMProviderError(f"Unsupported LLM provider: {name}")
    return providers[name]
