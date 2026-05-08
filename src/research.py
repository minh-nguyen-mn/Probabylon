from __future__ import annotations

import re
from urllib.parse import quote_plus

import httpx

from .models import ResearchPacket


def _clean_text(raw: str) -> str:
    return re.sub(r"\s+", " ", raw).strip()


def _extract_snippets(html: str, limit: int = 6) -> list[str]:
    snippets = re.findall(r"<a[^>]+class=\"result__a\"[^>]*>(.*?)</a>", html)
    clean = []
    for s in snippets[:limit]:
        text = re.sub(r"<[^>]+>", "", s)
        text = _clean_text(text)
        if text:
            clean.append(text)
    return clean


def _extract_links(html: str, limit: int = 6) -> list[str]:
    links = re.findall(r"<a[^>]+class=\"result__a\"[^>]+href=\"([^\"]+)\"", html)
    return links[:limit]


def run_independent_research(question: str, worldview: str, timeout: float = 10.0) -> ResearchPacket:
    query = f"{question} {worldview}"
    url = f"https://duckduckgo.com/html/?q={quote_plus(query)}"
    snippets: list[str] = []
    links: list[str] = []
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            response = client.get(url)
            response.raise_for_status()
            snippets = _extract_snippets(response.text)
            links = _extract_links(response.text)
    except Exception as exc:
        snippets = [f"Research fetch failed: {exc}"]
        links = []

    if not snippets:
        snippets = ["No strong external snippets found; fallback to prior + worldview assumptions."]
    return ResearchPacket(query=query, snippets=snippets, urls=links)
