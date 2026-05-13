from __future__ import annotations

import json
import logging
from typing import Literal, Optional

from pydantic import BaseModel, ValidationError

from app.llm import OpenRouterClient

logger = logging.getLogger(__name__)

_SCHEMA = {
    "type": "object",
    "properties": {
        "topic": {"type": "string"},
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "type": {"type": "string", "enum": ["mcq", "short"]},
                    "options": {"type": "array", "items": {"type": "string"}, "nullable": True},
                    "answer": {"type": "string"},
                    "explanation": {"type": "string"},
                    "source": {"type": "string", "nullable": True},
                },
                "required": ["question", "type", "answer", "explanation"],
            },
        },
    },
    "required": ["topic", "questions"],
}


class QuizGenerationError(RuntimeError):
    pass


class QuizQuestion(BaseModel):
    question: str
    type: Literal["mcq", "short"]
    options: Optional[list[str]] = None
    answer: str
    explanation: str
    source: Optional[str] = None


class Quiz(BaseModel):
    topic: str
    questions: list[QuizQuestion]


def _parse(raw: str, topic: str) -> Quiz:
    data = json.loads(raw)
    if "questions" not in data:
        # LLM sometimes wraps in a key
        for v in data.values():
            if isinstance(v, list):
                data = {"topic": topic, "questions": v}
                break
    return Quiz.model_validate(data)


def generate_quiz(
    topic: str,
    context: str,
    n_questions: int,
    llm: OpenRouterClient,
    source_refs: list[dict] | None = None,
) -> Quiz:
    truncated_context = context[:6000]

    system_prompt = (
        "Tu es un générateur de quiz pédagogique. "
        "Réponds UNIQUEMENT avec un objet JSON valide conforme au schéma suivant, sans texte autour.\n"
        f"Schéma JSON: {json.dumps(_SCHEMA, ensure_ascii=False)}"
    )

    user_prompt = (
        f"Génère exactement {n_questions} questions de quiz sur le sujet : {topic}\n\n"
        f"Contexte :\n{truncated_context}\n\n"
        "Instructions :\n"
        "- Pour les questions MCQ, fournis 4 options dans 'options'.\n"
        "- Pour les questions à réponse courte, laisse 'options' à null.\n"
        "- Si le contexte contient des marqueurs [Source: fichier, page: N], utilise-les dans le champ 'source'.\n"
        f"- Le champ 'topic' doit être : {topic}\n"
        f"- Génère exactement {n_questions} questions."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    raw = llm.chat(messages, temperature=0.3, response_format={"type": "json_object"}, max_tokens=2048)

    try:
        quiz = _parse(raw, topic)
    except (json.JSONDecodeError, ValidationError, KeyError, TypeError) as first_err:
        logger.warning("First quiz parse failed (%s), retrying once.", first_err)
        retry_messages = messages + [
            {"role": "assistant", "content": raw},
            {
                "role": "user",
                "content": (
                    f"Le JSON est invalide. Renvoie strictement un objet conforme au schéma. "
                    f"Erreur: {first_err}"
                ),
            },
        ]
        raw2 = llm.chat(retry_messages, temperature=0.3, response_format={"type": "json_object"}, max_tokens=2048)
        try:
            quiz = _parse(raw2, topic)
        except (json.JSONDecodeError, ValidationError, KeyError, TypeError) as second_err:
            raise QuizGenerationError(str(second_err)) from second_err

    # Enforce question count softly
    if len(quiz.questions) == 0:
        raise QuizGenerationError("LLM returned 0 questions.")
    if len(quiz.questions) > n_questions:
        quiz = Quiz(topic=quiz.topic, questions=quiz.questions[:n_questions])

    return quiz
