from __future__ import annotations

import json
import logging
from typing import Literal

from app.llm import GeminiClient

logger = logging.getLogger(__name__)

_TOOLS_TOKENS = frozenset([
    "récent", "actualité", "actualités", "latest", "news",
    "2025", "2026", "aujourd'hui", "today", "cherche", "internet", "web", "actualisé",
])

_RAG_TOKENS = frozenset([
    "cours", "document", "doc", "support", "fichier", "pdf",
    "ingéré", "ingere", "ingestion", "ce document", "le doc", "mon cours",
])

_ROUTER_SYSTEM_PROMPT = (
    "Choisis 'rag' si la question porte sur des documents ingérés (cours, supports), "
    "'tools' si c'est une question générale/récente. "
    'Réponds en JSON {"route": "rag"|"tools"}.'
)


def route_query(
    query: str,
    has_documents: bool,
    llm: GeminiClient,
) -> Literal["rag", "tools"]:
    lower = query.lower()

    force_tools = any(tok in lower for tok in _TOOLS_TOKENS)
    force_rag = any(tok in lower for tok in _RAG_TOKENS)

    if force_rag and not force_tools:
        return "rag"
    if force_tools and not force_rag:
        return "tools"
    if force_tools and force_rag:
        # tie-breaker via LLM
        pass
    else:
        # neither matched
        return "rag" if has_documents else "tools"

    # LLM tie-breaker
    messages = [
        {"role": "system", "content": _ROUTER_SYSTEM_PROMPT},
        {"role": "user", "content": query},
    ]
    try:
        raw = llm.chat(
            messages,
            temperature=0,
            response_format={"type": "json_object"},
            max_tokens=50,
        )
        data = json.loads(raw)
        route = data.get("route", "")
        if route in ("rag", "tools"):
            return route  # type: ignore[return-value]
    except Exception as exc:
        logger.warning("Router LLM call failed (%s), using fallback.", exc)

    return "rag" if has_documents else "tools"


def router_node(
    state: dict,
    *,
    llm: GeminiClient,
    store: object,
) -> dict:
    query: str = state["user_query"]
    has_documents: bool = store.count() > 0  # type: ignore[attr-defined]
    route = route_query(query, has_documents, llm)
    thoughts: list[dict] = list(state.get("thoughts") or [])
    thoughts.append({"stage": "Routeur", "content": f"-> {route}"})
    state = {**state, "route": route, "thoughts": thoughts}
    return state
