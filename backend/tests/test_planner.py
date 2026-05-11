"""Unit tests for the difficulty planner."""
from __future__ import annotations

from models import database as db
from services.planner import compute_next_difficulty


def _seed(session_id: str, results: list[bool], starting: str = "facile") -> None:
    db.ensure_session(session_id, difficulty=starting)
    for i, ok in enumerate(results):
        db.save_question(
            question_id=f"q_{session_id}_{i}",
            session_id=session_id,
            question_text="?",
            choices=["a", "b", "c", "d"],
            correct_index=0,
            difficulty=starting,
            source_document="s.md",
            source_page=None,
            source_chunk="x",
            chunk_id=f"c_{i}",
        )
        db.save_answer(
            question_id=f"q_{session_id}_{i}",
            session_id=session_id,
            selected_index=0 if ok else 1,
            is_correct=ok,
            difficulty=starting,
            source_document="s.md",
        )


def test_planner_stays_when_history_too_short(tmp_db):
    _seed("s1", [True, True], starting="facile")
    assert compute_next_difficulty("s1") == "facile"


def test_planner_promotes_when_high_score(tmp_db):
    _seed("s2", [True] * 5, starting="facile")
    assert compute_next_difficulty("s2") == "moyen"


def test_planner_caps_at_difficile(tmp_db):
    _seed("s3", [True] * 5, starting="difficile")
    assert compute_next_difficulty("s3") == "difficile"


def test_planner_demotes_when_low_score(tmp_db):
    _seed("s4", [False] * 5, starting="moyen")
    assert compute_next_difficulty("s4") == "facile"


def test_planner_keeps_when_middling(tmp_db):
    _seed("s5", [True, True, True, False, False], starting="moyen")
    # 60% -> stay
    assert compute_next_difficulty("s5") == "moyen"
