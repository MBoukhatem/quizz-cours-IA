from __future__ import annotations

import logging
from typing import Any

from duckduckgo_search import DDGS

logger = logging.getLogger(__name__)


def web_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    if not query or not query.strip():
        return []

    try:
        with DDGS() as ddgs:
            raw = ddgs.text(query, max_results=max_results)
            return [
                {"title": r.get("title", ""), "url": r.get("href", ""), "snippet": r.get("body", "")}
                for r in (raw or [])
            ]
    except Exception as exc:
        logger.warning("web_search failed for query %r: %s", query, exc)
        return []
