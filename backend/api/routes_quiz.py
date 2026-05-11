"""Quiz generation and evaluation endpoints."""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from models import database as db
from models.schemas import (
    QuizAnswerRequest,
    QuizAnswerResponse,
    QuizGenerateRequest,
    QuizQuestion,
    QuizSessionState,
)
from services.llm_client import LLMError
from services.quiz_evaluator import evaluate_answer
from services.quiz_generator import generate_question

router = APIRouter()
logger = logging.getLogger("tuteur_quiz.routes_quiz")


@router.post("/generate", response_model=QuizQuestion)
async def quiz_generate(req: QuizGenerateRequest) -> QuizQuestion:
    try:
        return await generate_question(
            session_id=req.session_id,
            forced_difficulty=req.difficulty,
            document_id=req.document_id,
        )
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/answer", response_model=QuizAnswerResponse)
async def quiz_answer(req: QuizAnswerRequest) -> QuizAnswerResponse:
    try:
        return await evaluate_answer(
            question_id=req.question_id,
            session_id=req.session_id,
            selected_index=req.selected_index,
        )
    except LLMError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/session/{session_id}", response_model=QuizSessionState)
async def quiz_session_state(session_id: str) -> QuizSessionState:
    correct, total = db.session_score(session_id)
    difficulty = db.get_session_difficulty(session_id)
    rate = round(100 * correct / total, 2) if total else 0.0
    return QuizSessionState(
        session_id=session_id,
        total_questions=total,
        correct_answers=correct,
        current_difficulty=difficulty,  # type: ignore[arg-type]
        success_rate=rate,
    )
