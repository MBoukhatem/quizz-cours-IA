from __future__ import annotations

import logging
import os
import sys
import tempfile
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import get_settings
from app.graph import build_graph
from app.llm import make_client
from app.memory import ConversationMemory
from app.rag.chunker import chunk_documents
from app.rag.embeddings import Embedder
from app.rag.loader import SUPPORTED_EXT, load_document
from app.rag.vectorstore import VectorStore
from app.security.prompt_guard import is_injection, sanitize_user_input
from app.state import initial_state

logger = logging.getLogger(__name__)

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.app_log_level.upper(), logging.INFO),
    format="%(levelname)s %(name)s: %(message)s",
)
for noisy in ("httpx", "httpcore", "sentence_transformers", "chromadb"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

if not settings.gemini_api_key or settings.gemini_api_key == "REPLACE_ME":
    print(
        "Erreur: GEMINI_API_KEY manquante ou non configurée.\n"
        "Copiez .env.example vers .env et renseignez votre clé Google AI Studio.",
        file=sys.stderr,
    )
    sys.exit(2)

llm = make_client(settings)
embedder = Embedder(settings.embedding_model)
store = VectorStore(
    host=settings.chroma_host,
    port=settings.chroma_port,
    collection=settings.chroma_collection,
    embedder=embedder,
)
memory = ConversationMemory(max_turns=settings.max_history_turns)
graph = build_graph(llm, store)

app = FastAPI(title="quizz-cours-IA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    query: str


class Thought(BaseModel):
    stage: str
    content: str


class QuizQuestion(BaseModel):
    question: str
    type: Optional[str] = None
    options: Optional[list[str]] = None
    answer: Optional[str] = None
    explanation: Optional[str] = None
    source: Optional[str] = None


class Quiz(BaseModel):
    topic: Optional[str] = None
    questions: list[QuizQuestion] = []


class QueryResponse(BaseModel):
    thoughts: list[Thought]
    final_answer: str
    quiz: Optional[Quiz] = None
    sanitized_query: str
    injection_detected: bool


class StatusResponse(BaseModel):
    chunks: int
    history_size: int
    model: str
    available_models: list[str]
    store_mode: str


class ModelsResponse(BaseModel):
    current: str
    available: list[str]


class SetModelRequest(BaseModel):
    model: str


@app.get("/api/status", response_model=StatusResponse)
def get_status() -> StatusResponse:
    return StatusResponse(
        chunks=store.count(),
        history_size=len(memory.history()),
        model=llm.current_model,
        available_models=llm.allowed_models,
        store_mode="local fallback" if store.using_fallback else "chroma HTTP",
    )


@app.get("/api/models", response_model=ModelsResponse)
def list_models() -> ModelsResponse:
    return ModelsResponse(current=llm.current_model, available=llm.allowed_models)


@app.post("/api/models", response_model=ModelsResponse)
def set_model(req: SetModelRequest) -> ModelsResponse:
    try:
        llm.set_model(req.model)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ModelsResponse(current=llm.current_model, available=llm.allowed_models)


@app.post("/api/reset")
def reset_all() -> dict:
    store.reset()
    memory.clear()
    return {"ok": True}


@app.post("/api/query", response_model=QueryResponse)
def post_query(req: QueryRequest) -> QueryResponse:
    raw = (req.query or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty query")

    sanitized = sanitize_user_input(raw)
    detected, _ = is_injection(raw)

    state = initial_state(sanitized, memory.history())
    try:
        result = graph.invoke(state)
    except Exception as exc:
        logger.exception("Graph invoke error")
        raise HTTPException(status_code=500, detail=f"Graph error: {exc}") from exc

    thoughts = [
        Thought(stage=t.get("stage", ""), content=t.get("content", ""))
        for t in (result.get("thoughts") or [])
    ]
    final = result.get("final_answer") or ""
    quiz_data = result.get("quiz")

    memory.add("user", sanitized)
    memory.add("assistant", final)

    quiz_obj: Optional[Quiz] = None
    if isinstance(quiz_data, dict):
        questions = [
            QuizQuestion(
                question=q.get("question", ""),
                type=q.get("type"),
                options=q.get("options"),
                answer=q.get("answer"),
                explanation=q.get("explanation"),
                source=q.get("source"),
            )
            for q in (quiz_data.get("questions") or [])
        ]
        quiz_obj = Quiz(topic=quiz_data.get("topic"), questions=questions)

    return QueryResponse(
        thoughts=thoughts,
        final_answer=final,
        quiz=quiz_obj,
        sanitized_query=sanitized,
        injection_detected=detected,
    )


@app.post("/api/ingest")
async def ingest_file(file: UploadFile = File(...)) -> dict:
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in SUPPORTED_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported extension '{ext}'. Supported: {sorted(SUPPORTED_EXT)}",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    tmpdir = tempfile.mkdtemp(prefix="quizz_upload_")
    safe_name = os.path.basename(filename)
    tmppath = os.path.join(tmpdir, safe_name)
    with open(tmppath, "wb") as fh:
        fh.write(content)

    try:
        docs = load_document(tmppath)
        chunks = chunk_documents(docs)
        store.add(chunks)
    except Exception as exc:
        logger.exception("Ingest error")
        raise HTTPException(status_code=500, detail=f"Ingest failed: {exc}") from exc
    finally:
        try:
            os.remove(tmppath)
            os.rmdir(tmpdir)
        except OSError:
            pass

    return {"ok": True, "filename": safe_name, "chunks": len(chunks)}


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}
