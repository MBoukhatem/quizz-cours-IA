"""Pydantic request/response models."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Difficulty = Literal["facile", "moyen", "difficile"]


# ----------------------------- Health -----------------------------

class ComponentHealth(BaseModel):
    name: str
    healthy: bool
    detail: str = ""


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "down"]
    components: list[ComponentHealth]


# ----------------------------- Upload -----------------------------

class UploadResponse(BaseModel):
    document_id: str
    filename: str
    n_chunks: int
    status: Literal["indexed", "failed"] = "indexed"
    message: str = ""


class DocumentInfo(BaseModel):
    document_id: str
    filename: str
    n_chunks: int
    uploaded_at: datetime


class DocumentList(BaseModel):
    documents: list[DocumentInfo]
    total: int


# ----------------------------- Quiz -----------------------------

class QuizGenerateRequest(BaseModel):
    session_id: str = Field(..., description="Identifier of the user session.")
    difficulty: Optional[Difficulty] = Field(
        default=None, description="Forced difficulty; otherwise computed by the planner."
    )
    document_id: Optional[str] = Field(
        default=None, description="Restrict generation to a single document."
    )


class QuizQuestion(BaseModel):
    question_id: str
    session_id: str
    question: str
    choices: list[str]
    correct_index: int
    difficulty: Difficulty
    source_document: str
    source_page: Optional[int] = None
    source_chunk: str
    chunk_id: str


class QuizAnswerRequest(BaseModel):
    question_id: str
    session_id: str
    selected_index: int


class QuizAnswerResponse(BaseModel):
    is_correct: bool
    correct_index: int
    explanation: str
    source_reference: str
    new_difficulty: Difficulty
    score_session: int
    total_session: int


class QuizSessionState(BaseModel):
    session_id: str
    total_questions: int
    correct_answers: int
    current_difficulty: Difficulty
    success_rate: float


# ----------------------------- Stats -----------------------------

class StatsSummary(BaseModel):
    total_questions: int
    correct_answers: int
    success_rate: float
    current_difficulty: Difficulty
    sessions_count: int
    documents_indexed: int
    total_chunks: int


class HistoryEntry(BaseModel):
    session_id: str
    started_at: datetime
    total_questions: int
    correct_answers: int
    success_rate: float


class HistoryResponse(BaseModel):
    sessions: list[HistoryEntry]


class TopicScore(BaseModel):
    source_document: str
    total: int
    correct: int
    success_rate: float


class TopicsResponse(BaseModel):
    topics: list[TopicScore]
