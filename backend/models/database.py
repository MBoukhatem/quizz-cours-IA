"""SQLite persistence for sessions, questions and answers."""
from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime
from typing import Iterator, Optional

_LOCK = threading.Lock()
_DB_PATH: Optional[str] = None


SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    session_id     TEXT PRIMARY KEY,
    started_at     TEXT NOT NULL,
    current_difficulty TEXT NOT NULL DEFAULT 'facile'
);

CREATE TABLE IF NOT EXISTS questions (
    question_id    TEXT PRIMARY KEY,
    session_id     TEXT NOT NULL,
    created_at     TEXT NOT NULL,
    question_text  TEXT NOT NULL,
    choices_json   TEXT NOT NULL,
    correct_index  INTEGER NOT NULL,
    difficulty     TEXT NOT NULL,
    source_document TEXT NOT NULL,
    source_page    INTEGER,
    source_chunk   TEXT NOT NULL,
    chunk_id       TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES sessions(session_id)
);

CREATE TABLE IF NOT EXISTS answers (
    answer_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id    TEXT NOT NULL,
    session_id     TEXT NOT NULL,
    answered_at    TEXT NOT NULL,
    selected_index INTEGER NOT NULL,
    is_correct     INTEGER NOT NULL,
    difficulty     TEXT NOT NULL,
    source_document TEXT NOT NULL,
    FOREIGN KEY(question_id) REFERENCES questions(question_id),
    FOREIGN KEY(session_id) REFERENCES sessions(session_id)
);

CREATE TABLE IF NOT EXISTS documents (
    document_id    TEXT PRIMARY KEY,
    filename       TEXT NOT NULL,
    n_chunks       INTEGER NOT NULL,
    uploaded_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
CREATE INDEX IF NOT EXISTS idx_questions_session ON questions(session_id);
"""


def init_db(path: str) -> None:
    """Initialise (or migrate) the SQLite schema. Idempotent."""
    global _DB_PATH
    _DB_PATH = path
    with _connect() as conn:
        conn.executescript(SCHEMA)
        conn.commit()


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    if _DB_PATH is None:
        raise RuntimeError("Database not initialised. Call init_db(path) first.")
    with _LOCK:
        conn = sqlite3.connect(_DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()


# ----------------------------- Sessions -----------------------------

def ensure_session(session_id: str, difficulty: str = "facile") -> None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT session_id FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        if row is None:
            conn.execute(
                "INSERT INTO sessions (session_id, started_at, current_difficulty) VALUES (?, ?, ?)",
                (session_id, datetime.utcnow().isoformat(), difficulty),
            )
            conn.commit()


def update_session_difficulty(session_id: str, difficulty: str) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE sessions SET current_difficulty = ? WHERE session_id = ?",
            (difficulty, session_id),
        )
        conn.commit()


def get_session_difficulty(session_id: str, default: str = "facile") -> str:
    with _connect() as conn:
        row = conn.execute(
            "SELECT current_difficulty FROM sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        return row["current_difficulty"] if row else default


# ----------------------------- Questions -----------------------------

def save_question(
    question_id: str,
    session_id: str,
    question_text: str,
    choices: list[str],
    correct_index: int,
    difficulty: str,
    source_document: str,
    source_page: Optional[int],
    source_chunk: str,
    chunk_id: str,
) -> None:
    with _connect() as conn:
        conn.execute(
            """INSERT INTO questions
               (question_id, session_id, created_at, question_text, choices_json,
                correct_index, difficulty, source_document, source_page, source_chunk, chunk_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                question_id,
                session_id,
                datetime.utcnow().isoformat(),
                question_text,
                json.dumps(choices, ensure_ascii=False),
                correct_index,
                difficulty,
                source_document,
                source_page,
                source_chunk,
                chunk_id,
            ),
        )
        conn.commit()


def get_question(question_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM questions WHERE question_id = ?", (question_id,)
        ).fetchone()
        if row is None:
            return None
        data = dict(row)
        data["choices"] = json.loads(data.pop("choices_json"))
        return data


def used_chunk_ids(session_id: str, limit: int = 20) -> list[str]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT chunk_id FROM questions WHERE session_id = ? "
            "ORDER BY created_at DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
        return [row["chunk_id"] for row in rows]


# ----------------------------- Answers -----------------------------

def save_answer(
    question_id: str,
    session_id: str,
    selected_index: int,
    is_correct: bool,
    difficulty: str,
    source_document: str,
) -> None:
    with _connect() as conn:
        conn.execute(
            """INSERT INTO answers
               (question_id, session_id, answered_at, selected_index, is_correct,
                difficulty, source_document)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                question_id,
                session_id,
                datetime.utcnow().isoformat(),
                selected_index,
                1 if is_correct else 0,
                difficulty,
                source_document,
            ),
        )
        conn.commit()


def recent_answers(session_id: str, limit: int = 5) -> list[dict]:
    """Most recent answers (newest first)."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM answers WHERE session_id = ? "
            "ORDER BY answered_at DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]


def session_score(session_id: str) -> tuple[int, int]:
    """Return (correct, total) for the session."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS total, SUM(is_correct) AS correct "
            "FROM answers WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        total = row["total"] or 0
        correct = row["correct"] or 0
        return int(correct), int(total)


# ----------------------------- Documents -----------------------------

def save_document(document_id: str, filename: str, n_chunks: int) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO documents (document_id, filename, n_chunks, uploaded_at) "
            "VALUES (?, ?, ?, ?)",
            (document_id, filename, n_chunks, datetime.utcnow().isoformat()),
        )
        conn.commit()


def delete_document(document_id: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM documents WHERE document_id = ?", (document_id,))
        conn.commit()
        return cur.rowcount > 0


def list_documents() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM documents ORDER BY uploaded_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


# ----------------------------- Aggregates -----------------------------

def global_stats() -> dict:
    with _connect() as conn:
        ans = conn.execute(
            "SELECT COUNT(*) AS total, SUM(is_correct) AS correct FROM answers"
        ).fetchone()
        sessions = conn.execute("SELECT COUNT(*) AS n FROM sessions").fetchone()
        docs = conn.execute(
            "SELECT COUNT(*) AS n, COALESCE(SUM(n_chunks), 0) AS chunks FROM documents"
        ).fetchone()
        total = ans["total"] or 0
        correct = ans["correct"] or 0
        return {
            "total_questions": int(total),
            "correct_answers": int(correct),
            "success_rate": round(100 * correct / total, 2) if total else 0.0,
            "sessions_count": int(sessions["n"] or 0),
            "documents_indexed": int(docs["n"] or 0),
            "total_chunks": int(docs["chunks"] or 0),
        }


def history(limit: int = 50) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """SELECT s.session_id, s.started_at,
                      COUNT(a.answer_id) AS total,
                      COALESCE(SUM(a.is_correct), 0) AS correct
               FROM sessions s
               LEFT JOIN answers a ON a.session_id = s.session_id
               GROUP BY s.session_id
               ORDER BY s.started_at DESC
               LIMIT ?""",
            (limit,),
        ).fetchall()
        out = []
        for r in rows:
            total = r["total"] or 0
            correct = r["correct"] or 0
            out.append(
                {
                    "session_id": r["session_id"],
                    "started_at": r["started_at"],
                    "total_questions": int(total),
                    "correct_answers": int(correct),
                    "success_rate": round(100 * correct / total, 2) if total else 0.0,
                }
            )
        return out


def topics_breakdown() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """SELECT source_document,
                      COUNT(*) AS total,
                      COALESCE(SUM(is_correct), 0) AS correct
               FROM answers
               GROUP BY source_document
               ORDER BY total DESC"""
        ).fetchall()
        out = []
        for r in rows:
            total = r["total"] or 0
            correct = r["correct"] or 0
            out.append(
                {
                    "source_document": r["source_document"],
                    "total": int(total),
                    "correct": int(correct),
                    "success_rate": round(100 * correct / total, 2) if total else 0.0,
                }
            )
        return out
