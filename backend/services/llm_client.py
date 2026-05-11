"""Async Ollama client wrapper used by quiz generation and evaluation."""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

import httpx

from config import get_settings

logger = logging.getLogger("tuteur_quiz.llm")


class LLMError(RuntimeError):
    pass


class OllamaClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[int] = None,
    ) -> None:
        s = get_settings()
        self.base_url = (base_url or s.ollama_base_url).rstrip("/")
        self.model = model or s.ollama_model
        self.timeout = timeout or s.ollama_timeout

    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.3,
        format_json: bool = False,
        max_tokens: Optional[int] = None,
    ) -> str:
        url = f"{self.base_url}/api/generate"
        payload: dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if system:
            payload["system"] = system
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens
        if format_json:
            payload["format"] = "json"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
        except httpx.TimeoutException as exc:
            raise LLMError(f"Ollama timeout after {self.timeout}s") from exc
        except httpx.HTTPError as exc:
            raise LLMError(f"Ollama HTTP error: {exc}") from exc

        text = data.get("response", "")
        if not text:
            raise LLMError("Empty response from Ollama")
        return text

    async def ping(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                resp.raise_for_status()
                return True
        except Exception as exc:
            logger.warning("Ollama ping failed: %s", exc)
            return False

    async def model_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                resp.raise_for_status()
                tags = resp.json().get("models", [])
                names = {m.get("name", "").split(":")[0] for m in tags} | {
                    m.get("name", "") for m in tags
                }
                return self.model in names or self.model.split(":")[0] in names
        except Exception:
            return False


_client: Optional[OllamaClient] = None


def get_llm_client() -> OllamaClient:
    global _client
    if _client is None:
        _client = OllamaClient()
    return _client


def parse_json_response(text: str) -> dict:
    """Robustly parse a JSON object from a LLM response.

    Local LLMs frequently wrap JSON in prose or markdown fences; we strip those.
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise LLMError(f"No JSON object found in LLM response: {text[:200]}")
    candidate = cleaned[start : end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise LLMError(f"Invalid JSON from LLM: {exc}; raw={candidate[:200]}") from exc
