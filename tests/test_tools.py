from __future__ import annotations

import json

import pytest

from tests.conftest import make_fake_llm


# ---------------------------------------------------------------------------
# test_quiz_generator_nominal_valid_json
# ---------------------------------------------------------------------------

def test_quiz_generator_nominal_valid_json():
    from app.tools.quiz_generator import Quiz, generate_quiz

    valid_quiz = {
        "topic": "Machine Learning",
        "questions": [
            {
                "question": "Qu'est-ce que la régression linéaire?",
                "type": "mcq",
                "options": ["A", "B", "C", "D"],
                "answer": "A",
                "explanation": "La régression linéaire modélise une relation linéaire.",
                "source": None,
            },
            {
                "question": "Qu'est-ce que le surapprentissage?",
                "type": "short",
                "options": None,
                "answer": "Un modèle trop adapté aux données d'entraînement.",
                "explanation": "Il généralise mal sur les données de test.",
                "source": None,
            },
            {
                "question": "Quel algorithme utilise des arbres de décision?",
                "type": "mcq",
                "options": ["Random Forest", "KNN", "SVM", "Naive Bayes"],
                "answer": "Random Forest",
                "explanation": "Random Forest est un ensemble d'arbres de décision.",
                "source": None,
            },
        ],
    }

    llm = make_fake_llm()
    llm.enqueue(json.dumps(valid_quiz))

    quiz = generate_quiz(
        topic="Machine Learning",
        context="Contexte de test.",
        n_questions=3,
        llm=llm,
    )

    assert isinstance(quiz, Quiz)
    assert len(quiz.questions) == 3
    assert quiz.questions[0].type == "mcq"
    assert quiz.questions[1].type == "short"


# ---------------------------------------------------------------------------
# test_web_search_edge_empty_query
# ---------------------------------------------------------------------------

def test_web_search_edge_empty_query():
    from app.tools.web_search import web_search

    results = web_search("", max_results=5)
    assert results == []


# ---------------------------------------------------------------------------
# test_quiz_generator_error_invalid_json
# ---------------------------------------------------------------------------

def test_quiz_generator_error_invalid_json():
    from app.tools.quiz_generator import QuizGenerationError, generate_quiz

    llm = make_fake_llm()
    llm.enqueue("this is not json at all")
    llm.enqueue("still not json {{{{")

    with pytest.raises(QuizGenerationError):
        generate_quiz(
            topic="Test",
            context="Contexte de test.",
            n_questions=3,
            llm=llm,
        )
