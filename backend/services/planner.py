"""Difficulty planner and topic selector.

Stateless functions that read the session history from SQLite and decide:
  * the next difficulty level
  * which topic / chunk to use, avoiding repetition.
"""
from __future__ import annotations

import logging
import random
from typing import Optional

from config import get_settings
from models import database as db
from services.vectorstore import get_vectorstore

logger = logging.getLogger("tuteur_quiz.planner")

DIFFICULTIES = ("facile", "moyen", "difficile")
TOPIC_SEEDS = {
    "facile": [
        "définition",
        "concept de base",
        "notion introductive",
        "exemple simple",
    ],
    "moyen": [
        "application concrète",
        "lien entre deux concepts",
        "comparaison",
        "cas d'usage",
    ],
    "difficile": [
        "analyse approfondie",
        "raisonnement complexe",
        "cas limite",
        "synthèse critique",
    ],
}


def compute_next_difficulty(session_id: str) -> str:
    """Adapt difficulty based on the score over the last N answers."""
    s = get_settings()
    current = db.get_session_difficulty(session_id, default=s.default_difficulty)
    recent = db.recent_answers(session_id, limit=s.questions_for_adaptation)
    if len(recent) < s.questions_for_adaptation:
        return current
    correct = sum(1 for r in recent if r["is_correct"])
    rate = correct / len(recent) * 100
    idx = DIFFICULTIES.index(current)
    if rate >= 90 and idx < len(DIFFICULTIES) - 1:
        return DIFFICULTIES[idx + 1]
    if rate < 60 and idx > 0:
        return DIFFICULTIES[idx - 1]
    return current


def select_chunk(
    session_id: str,
    difficulty: str,
    document_id: Optional[str] = None,
) -> Optional[dict]:
    """Pick a chunk to build the next question from.

    Strategy: semantic query on a topic seed for the difficulty level, excluding
    the chunks recently used in this session. Falls back to a random sample.
    """
    s = get_settings()
    store = get_vectorstore()
    used = db.used_chunk_ids(session_id, limit=20)
    seed = random.choice(TOPIC_SEEDS.get(difficulty, TOPIC_SEEDS["facile"]))
    results = store.query(
        text=seed,
        top_k=s.top_k_chunks,
        exclude_chunk_ids=used,
        document_id=document_id,
    )
    if not results:
        # Fallback: any chunk we haven't used yet.
        fallback = store.random_chunks(n=s.top_k_chunks, document_id=document_id)
        results = [r for r in fallback if r["chunk_id"] not in set(used)]
    if not results:
        return None
    return random.choice(results[: max(1, len(results) // 2 or 1)])
