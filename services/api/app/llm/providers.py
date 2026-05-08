from __future__ import annotations

from typing import Protocol

import httpx

from app.core.config import settings


class LLMProvider(Protocol):
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        ...


class OpenRouterProvider:
    async def generate(self, system_prompt: str, user_prompt: str, temperature: float, max_tokens: int) -> str:
        headers = {"Authorization": f"Bearer {settings.openrouter_api_key}", "Content-Type": "application/json"}
        payload = {
            "model": settings.default_llm_model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        }
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]


class OpenAIProvider:
    async def generate(self, system_prompt: str, user_prompt: str, temperature: float, max_tokens: int) -> str:
        headers = {"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"}
        payload = {
            "model": "gpt-4.1-mini",
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        }
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]


class AnthropicProvider:
    async def generate(self, system_prompt: str, user_prompt: str, temperature: float, max_tokens: int) -> str:
        headers = {
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {"model": "claude-sonnet-4-20250514", "max_tokens": max_tokens, "temperature": temperature, "system": system_prompt, "messages": [{"role": "user", "content": user_prompt}]}
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            response.raise_for_status()
            return response.json()["content"][0]["text"]


class GroqProvider:
    async def generate(self, system_prompt: str, user_prompt: str, temperature: float, max_tokens: int) -> str:
        headers = {"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"}
        payload = {
            "model": "deepseek-r1-distill-llama-70b",
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        }
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]


def get_provider(name: str) -> LLMProvider:
    providers: dict[str, LLMProvider] = {
        "openrouter": OpenRouterProvider(),
        "openai": OpenAIProvider(),
        "anthropic": AnthropicProvider(),
        "groq": GroqProvider(),
    }
    return providers[name]
