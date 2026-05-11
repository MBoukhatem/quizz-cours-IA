"""Evaluate a student's answer and produce a feedback explanation."""
from __future__ import annotations

import logging
from typing import Optional

from models import database as db
from models.schemas import QuizAnswerResponse
from services.llm_client import LLMError, get_llm_client
from services.logger import get_audit_logger
from services.planner import compute_next_difficulty

logger = logging.getLogger("tuteur_quiz.quiz_evaluator")


EVAL_SYSTEM = (
    "Tu es un tuteur pédagogique francophone. Tu rédiges des explications courtes, claires, "
    "rigoureusement basées sur l'extrait de cours fourni. Pas plus de 5 phrases."
)

EVAL_PROMPT = """Question posée :
{question}

Choix proposés :
{choices_block}

L'étudiant a répondu : {user_choice}
Bonne réponse : {correct_choice}
Résultat : {result_word}

Extrait du cours (source unique de vérité) :
\"\"\"
{source_chunk}
\"\"\"

Tâche : explique en français pourquoi la bonne réponse est "{correct_choice}". {focus}
Cite brièvement l'élément du cours qui le justifie. N'invente rien hors du contexte.
"""


def _format_choices(choices: list[str]) -> str:
    letters = ["A", "B", "C", "D"]
    return "\n".join(f"  {letters[i]}. {c}" for i, c in enumerate(choices))


async def evaluate_answer(question_id: str, session_id: str, selected_index: int) -> QuizAnswerResponse:
    question = db.get_question(question_id)
    if question is None:
        raise LLMError(f"Question inconnue: {question_id}")

    choices: list[str] = question["choices"]
    if selected_index < 0 or selected_index >= len(choices):
        raise LLMError(f"selected_index hors bornes: {selected_index}")

    is_correct = selected_index == question["correct_index"]
    correct_choice = choices[question["correct_index"]]
    user_choice = choices[selected_index]
    focus = (
        "Confirme aussi en une phrase pourquoi le choix de l'étudiant est correct."
        if is_correct
        else "Indique aussi pourquoi le choix de l'étudiant est incorrect."
    )

    prompt = EVAL_PROMPT.format(
        question=question["question_text"],
        choices_block=_format_choices(choices),
        user_choice=user_choice,
        correct_choice=correct_choice,
        result_word="CORRECT" if is_correct else "INCORRECT",
        source_chunk=question["source_chunk"],
        focus=focus,
    )

    llm = get_llm_client()
    try:
        explanation = await llm.generate(prompt, system=EVAL_SYSTEM, temperature=0.2)
        explanation = explanation.strip()
    except LLMError as exc:
        logger.warning("LLM explanation failed, using fallback: %s", exc)
        explanation = _fallback_explanation(is_correct, correct_choice, question["source_chunk"])

    db.save_answer(
        question_id=question_id,
        session_id=session_id,
        selected_index=selected_index,
        is_correct=is_correct,
        difficulty=question["difficulty"],
        source_document=question["source_document"],
    )

    new_difficulty = compute_next_difficulty(session_id)
    db.update_session_difficulty(session_id, new_difficulty)
    correct_count, total_count = db.session_score(session_id)

    page = question.get("source_page")
    source_ref = (
        f"{question['source_document']} (p. {page})" if page else question["source_document"]
    )

    get_audit_logger().info(
        event_type="quiz_answer",
        session_id=session_id,
        extra_data={
            "question_id": question_id,
            "question_text": question["question_text"],
            "user_answer": selected_index,
            "correct_answer": question["correct_index"],
            "is_correct": is_correct,
            "difficulty": question["difficulty"],
            "source_document": question["source_document"],
            "source_page": page,
            "llm_model": llm.model,
        },
    )

    return QuizAnswerResponse(
        is_correct=is_correct,
        correct_index=question["correct_index"],
        explanation=explanation,
        source_reference=source_ref,
        new_difficulty=new_difficulty,
        score_session=correct_count,
        total_session=total_count,
    )


def _fallback_explanation(is_correct: bool, correct_choice: str, source: str) -> str:
    head = "Bonne réponse !" if is_correct else "Réponse incorrecte."
    excerpt = source[:240] + ("..." if len(source) > 240 else "")
    return (
        f"{head} La réponse attendue est : « {correct_choice} ». "
        f"Extrait du cours : {excerpt}"
    )
