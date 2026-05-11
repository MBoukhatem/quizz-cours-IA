"""FastAPI entry point for the Tuteur Quiz Adaptatif backend."""
from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import routes_health, routes_quiz, routes_stats, routes_upload
from config import get_settings
from models.database import init_db
from services.logger import get_audit_logger

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("tuteur_quiz")

app = FastAPI(
    title="Tuteur Quiz Adaptatif",
    description="Agent IA local RAG + QCM, 100% gratuit",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_health.router, prefix="/api", tags=["health"])
app.include_router(routes_upload.router, prefix="/api", tags=["upload"])
app.include_router(routes_quiz.router, prefix="/api/quiz", tags=["quiz"])
app.include_router(routes_stats.router, prefix="/api/stats", tags=["stats"])


@app.on_event("startup")
async def on_startup() -> None:
    os.makedirs(settings.log_dir, exist_ok=True)
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(os.path.dirname(settings.database_path), exist_ok=True)
    init_db(settings.database_path)
    get_audit_logger().info("backend_startup", extra_data={"model": settings.ollama_model})
    logger.info("Backend ready on %s:%s", settings.backend_host, settings.backend_port)


@app.get("/")
async def root() -> dict:
    return {
        "name": "Tuteur Quiz Adaptatif",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }
