from __future__ import annotations

import json
import logging
import re
from typing import Literal, Optional

from pydantic import BaseModel, ValidationError

from app.llm import OllamaClient

logger = logging.getLogger(__name__)


_N_QUESTIONS_RE = re.compile(
    r"(?:quiz|qcm|questionnaire)\s+(?:de\s+|d['e]\s*|with\s+|of\s+)?(\d{1,2})\s*(?:questions?|qcm)?",
    re.IGNORECASE,
)
_BARE_N_RE = re.compile(r"\b(\d{1,2})\s*questions?\b", re.IGNORECASE)


def extract_n_questions(query: str, default: int = 5, lo: int = 1, hi: int = 20) -> int:
    """Pull an integer count from prompts like 'Génère un quiz de 7 questions…'.

    Falls back to `default` if nothing parseable is found. Clamps to [lo, hi]
    so a stray big number can't blow up token budgets.
    """
    for rx in (_N_QUESTIONS_RE, _BARE_N_RE):
        m = rx.search(query)
        if m:
            try:
                n = int(m.group(1))
            except ValueError:
                continue
            return max(lo, min(hi, n))
    return default

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


def _salvage_truncated_json(raw: str, topic: str) -> Optional[dict]:
    """If the LLM was cut off mid-response, try to recover the complete
    questions emitted so far by trimming the questions array to the last
    closed object and re-balancing braces.
    """
    start = raw.find("[")
    if start == -1:
        return None
    # Walk char by char, track depth & quoting, remember last position where
    # we just closed an object inside the top-level array.
    depth_obj = 0
    depth_arr = 0
    in_string = False
    escape = False
    last_safe_close = -1
    for i, ch in enumerate(raw[start:], start=start):
        if escape:
            escape = False
            continue
        if ch == "\\" and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "[":
            depth_arr += 1
        elif ch == "]":
            depth_arr -= 1
        elif ch == "{":
            depth_obj += 1
        elif ch == "}":
            depth_obj -= 1
            if depth_obj == 0 and depth_arr == 1:
                last_safe_close = i
    if last_safe_close == -1:
        return None
    truncated = raw[start : last_safe_close + 1] + "]"
    try:
        questions = json.loads(truncated)
    except json.JSONDecodeError:
        return None
    if not isinstance(questions, list) or not questions:
        return None
    return {"topic": topic, "questions": questions}


def _parse(raw: str, topic: str) -> Quiz:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        salvaged = _salvage_truncated_json(raw, topic)
        if salvaged is None:
            raise exc
        logger.warning(
            "Quiz JSON was truncated; salvaged %d questions",
            len(salvaged.get("questions", [])),
        )
        data = salvaged
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
    llm: OllamaClient,
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

    raw = llm.chat(messages, temperature=0.3, response_format={"type": "json_object"}, max_tokens=8192)

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
        raw2 = llm.chat(retry_messages, temperature=0.3, response_format={"type": "json_object"}, max_tokens=8192)
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
