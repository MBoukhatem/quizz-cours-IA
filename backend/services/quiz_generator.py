"""Generate multiple-choice questions from indexed corpus via RAG + LLM."""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from config import get_settings
from models import database as db
from models.schemas import QuizQuestion
from services.llm_client import LLMError, get_llm_client, parse_json_response
from services.logger import get_audit_logger
from services.planner import compute_next_difficulty, select_chunk

logger = logging.getLogger("tuteur_quiz.quiz_generator")


SYSTEM_PROMPT = (
    "Tu es un tuteur pédagogique francophone. Tu génères des questions à choix multiples "
    "(QCM) STRICTEMENT à partir du contexte de cours fourni. N'invente rien. "
    "Tu réponds uniquement avec un objet JSON valide, sans texte autour."
)

DIFFICULTY_INSTRUCTIONS = {
    "facile": (
        "Niveau FACILE. Pose une question de compréhension directe dont la réponse "
        "est explicitement écrite dans le contexte (définition, fait, date, terme)."
    ),
    "moyen": (
        "Niveau MOYEN. Pose une question qui nécessite de relier deux idées du contexte, "
        "ou d'appliquer une notion à un exemple proche."
    ),
    "difficile": (
        "Niveau DIFFICILE. Pose une question d'analyse ou d'inférence demandant de raisonner "
        "à partir du contexte (cas pratique, comparaison, synthèse)."
    ),
}

PROMPT_TEMPLATE = """{difficulty_instruction}

Contexte de cours (source unique de vérité) :
\"\"\"
{context}
\"\"\"

Contraintes :
- 1 seule question.
- Exactement 4 choix, mutuellement exclusifs, plausibles, en français.
- Une seule bonne réponse, présente dans le contexte.
- Les distracteurs doivent être crédibles mais clairement incorrects au regard du contexte.
- Pas d'emojis, pas de mise en forme markdown.

Réponds avec UNIQUEMENT cet objet JSON :
{{
  "question": "<énoncé clair>",
  "choices": ["<choix A>", "<choix B>", "<choix C>", "<choix D>"],
  "correct_index": <0|1|2|3>,
  "rationale": "<phrase qui cite l'élément du contexte justifiant la bonne réponse>"
}}
"""


def _build_prompt(context: str, difficulty: str) -> str:
    return PROMPT_TEMPLATE.format(
        difficulty_instruction=DIFFICULTY_INSTRUCTIONS.get(
            difficulty, DIFFICULTY_INSTRUCTIONS["facile"]
        ),
        context=context.strip(),
    )


def _validate_payload(payload: dict) -> dict:
    required = {"question", "choices", "correct_index"}
    missing = required - payload.keys()
    if missing:
        raise LLMError(f"LLM payload missing keys: {missing}")
    choices = payload["choices"]
    if not isinstance(choices, list) or len(choices) != 4:
        raise LLMError(f"choices must be a list of 4 strings, got: {choices}")
    if any(not isinstance(c, str) or not c.strip() for c in choices):
        raise LLMError("All 4 choices must be non-empty strings.")
    correct = payload["correct_index"]
    if not isinstance(correct, int) or correct < 0 or correct > 3:
        raise LLMError(f"correct_index must be 0..3, got: {correct}")
    return payload


async def generate_question(
    session_id: str,
    forced_difficulty: Optional[str] = None,
    document_id: Optional[str] = None,
) -> QuizQuestion:
    s = get_settings()
    db.ensure_session(session_id, difficulty=s.default_difficulty)

    difficulty = forced_difficulty or compute_next_difficulty(session_id)
    if difficulty not in DIFFICULTY_INSTRUCTIONS:
        difficulty = s.default_difficulty

    chunk = select_chunk(session_id, difficulty, document_id=document_id)
    if chunk is None:
        raise LLMError(
            "Aucun chunk disponible. Uploadez au moins un document avant de générer un quiz."
        )

    prompt = _build_prompt(chunk["text"], difficulty)
    llm = get_llm_client()

    payload: Optional[dict] = None
    last_err: Optional[Exception] = None
    for attempt in range(2):
        try:
            raw = await llm.generate(prompt, system=SYSTEM_PROMPT, format_json=True)
            payload = _validate_payload(parse_json_response(raw))
            break
        except LLMError as exc:
            last_err = exc
            logger.warning("LLM quiz generation attempt %d failed: %s", attempt + 1, exc)
    if payload is None:
        raise last_err or LLMError("LLM quiz generation failed.")

    question_id = f"q_{uuid.uuid4().hex[:12]}"
    meta = chunk.get("metadata", {}) or {}
    source_doc = meta.get("source", "inconnu")
    source_page = meta.get("page")

    db.save_question(
        question_id=question_id,
        session_id=session_id,
        question_text=payload["question"],
        choices=payload["choices"],
        correct_index=payload["correct_index"],
        difficulty=difficulty,
        source_document=source_doc,
        source_page=source_page,
        source_chunk=chunk["text"],
        chunk_id=chunk["chunk_id"],
    )
    db.update_session_difficulty(session_id, difficulty)

    get_audit_logger().info(
        event_type="quiz_generated",
        session_id=session_id,
        extra_data={
            "question_id": question_id,
            "difficulty": difficulty,
            "source_document": source_doc,
            "source_page": source_page,
            "model": llm.model,
        },
    )

    return QuizQuestion(
        question_id=question_id,
        session_id=session_id,
        question=payload["question"],
        choices=payload["choices"],
        correct_index=payload["correct_index"],
        difficulty=difficulty,
        source_document=source_doc,
        source_page=source_page,
        source_chunk=chunk["text"],
        chunk_id=chunk["chunk_id"],
    )
