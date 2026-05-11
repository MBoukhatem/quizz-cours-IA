"""Statistics endpoints: summary, session history, per-topic breakdown."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter

from models import database as db
from models.schemas import (
    HistoryEntry,
    HistoryResponse,
    StatsSummary,
    TopicScore,
    TopicsResponse,
)

router = APIRouter()


@router.get("/summary", response_model=StatsSummary)
async def stats_summary() -> StatsSummary:
    s = db.global_stats()
    hist = db.history(limit=1)
    current = hist[0]["session_id"] if hist else None
    difficulty = db.get_session_difficulty(current) if current else "facile"
    return StatsSummary(
        total_questions=s["total_questions"],
        correct_answers=s["correct_answers"],
        success_rate=s["success_rate"],
        current_difficulty=difficulty,  # type: ignore[arg-type]
        sessions_count=s["sessions_count"],
        documents_indexed=s["documents_indexed"],
        total_chunks=s["total_chunks"],
    )


@router.get("/history", response_model=HistoryResponse)
async def stats_history(limit: int = 50) -> HistoryResponse:
    rows = db.history(limit=limit)
    sessions = [
        HistoryEntry(
            session_id=r["session_id"],
            started_at=datetime.fromisoformat(r["started_at"]),
            total_questions=r["total_questions"],
            correct_answers=r["correct_answers"],
            success_rate=r["success_rate"],
        )
        for r in rows
    ]
    return HistoryResponse(sessions=sessions)


@router.get("/topics", response_model=TopicsResponse)
async def stats_topics() -> TopicsResponse:
    rows = db.topics_breakdown()
    topics = [
        TopicScore(
            source_document=r["source_document"],
            total=r["total"],
            correct=r["correct"],
            success_rate=r["success_rate"],
        )
        for r in rows
    ]
    return TopicsResponse(topics=topics)
