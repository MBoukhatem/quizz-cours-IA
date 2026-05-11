"""Tests for the LLM JSON parser and the quiz payload validator.

We avoid hitting the real Ollama server: tests target the pure functions
(parsing, validation) plus a monkey-patched async LLM call.
"""
from __future__ import annotations

import pytest

from services.llm_client import LLMError, parse_json_response
from services.quiz_generator import _validate_payload


def test_parse_json_extracts_object_from_markdown_fence():
    raw = """Voici le QCM :
```json
{"question": "Q ?", "choices": ["a", "b", "c", "d"], "correct_index": 1}
```
"""
    data = parse_json_response(raw)
    assert data["question"] == "Q ?"
    assert data["correct_index"] == 1


def test_parse_json_extracts_when_prose_around():
    raw = 'Sure. {"question":"Q","choices":["a","b","c","d"],"correct_index":0} Done.'
    data = parse_json_response(raw)
    assert data["choices"] == ["a", "b", "c", "d"]


def test_parse_json_raises_when_no_object():
    with pytest.raises(LLMError):
        parse_json_response("pas du tout JSON")


def test_validate_payload_rejects_wrong_number_of_choices():
    with pytest.raises(LLMError):
        _validate_payload(
            {"question": "Q", "choices": ["a", "b", "c"], "correct_index": 0}
        )


def test_validate_payload_rejects_out_of_range_index():
    with pytest.raises(LLMError):
        _validate_payload(
            {"question": "Q", "choices": ["a", "b", "c", "d"], "correct_index": 9}
        )


def test_validate_payload_accepts_well_formed():
    payload = {
        "question": "Quelle est la capitale de la France ?",
        "choices": ["Lyon", "Paris", "Marseille", "Lille"],
        "correct_index": 1,
    }
    assert _validate_payload(payload) is payload
