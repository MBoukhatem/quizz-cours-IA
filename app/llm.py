from __future__ import annotations

import logging
import threading
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    pass


# Default allowlist of local Ollama models, ordered by footprint.
DEFAULT_OLLAMA_MODELS: list[str] = [
    "qwen2.5:0.5b",
    "gemma2:2b",
    "llama3.2:3b",
    "qwen2.5:7b",
]


class OllamaClient:
    """Ollama HTTP client.

    Keeps the same surface as the previous Gemini/OpenRouter clients
    (chat / current_model / set_model / allowed_models) so the router,
    rag agent, tools agent and quiz_generator remain untouched.
    """

    def __init__(
        self,
        model: str,
        base_url: str = "http://ollama:11434",
        allowed_models: Optional[list[str]] = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._default_model = model
        self._current_model = model
        self._allowed = list(allowed_models) if allowed_models else list(DEFAULT_OLLAMA_MODELS)
        self._lock = threading.Lock()
        # Local model inference can be slow on CPU — keep a generous timeout.
        self._client = httpx.Client(timeout=300.0)

    # -------- model management --------
    @property
    def current_model(self) -> str:
        with self._lock:
            return self._current_model

    @property
    def allowed_models(self) -> list[str]:
        return list(self._allowed)

    def set_model(self, model: str) -> str:
        """Set the active model. Rejects anything not in the allowlist."""
        if model not in self._allowed:
            raise LLMError(
                f"Model '{model}' is not in the allowed list: {self._allowed}"
            )
        with self._lock:
            self._current_model = model
        logger.info("Active Ollama model set to %s", model)
        return model

    # -------- request --------
    def _do_request(
        self,
        model: str,
        messages: list[dict],
        temperature: float,
        max_tokens: int,
        response_format: Optional[dict],
    ) -> str:
        # Ollama accepts OpenAI-style {role, content} messages directly.
        body: dict = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        # Force JSON when caller asks for json_object — equivalent to
        # Gemini's responseMimeType: application/json.
        if response_format and response_format.get("type") == "json_object":
            body["format"] = "json"

        url = f"{self._base_url}/api/chat"

        try:
            resp = self._client.post(url, json=body)
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            raise LLMError(f"network: {exc}") from exc

        if resp.status_code == 404:
            # Ollama returns 404 when the model isn't pulled locally.
            raise LLMError(
                f"model '{model}' not found on Ollama. "
                f"Pull it with: docker compose exec ollama ollama pull {model}"
            )
        if resp.status_code >= 500:
            raise LLMError(f"upstream {resp.status_code} on {model}")
        if resp.status_code >= 400:
            raise LLMError(f"http {resp.status_code} on {model}: {resp.text[:200]}")

        data = resp.json()
        # Ollama /api/chat returns {"message": {"role": "...", "content": "..."}, "done": true, ...}
        message = data.get("message") or {}
        text = (message.get("content") or "").strip()
        if not text:
            done_reason = data.get("done_reason") or "?"
            raise LLMError(f"empty response from {model} (done_reason={done_reason})")
        return text

    # -------- public surface (unchanged) --------
    def chat(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.2,
        response_format: Optional[dict] = None,
        max_tokens: int = 2048,
    ) -> str:
        """Call the active model, retrying transient failures.

        Transient upstream errors (5xx, network) get a small exponential
        backoff before giving up, so a single hiccup doesn't surface as a
        failed quiz.
        """
        model = self.current_model
        delays = [1.0, 3.0]
        last_err: Optional[LLMError] = None
        for attempt in range(len(delays) + 1):
            try:
                return self._do_request(
                    model, messages, temperature, max_tokens, response_format
                )
            except LLMError as exc:
                last_err = exc
                msg = str(exc)
                transient = msg.startswith("upstream ") or msg.startswith("network:")
                if not transient or attempt >= len(delays):
                    logger.warning("Ollama call failed on %s: %s", model, msg)
                    raise
                logger.info(
                    "Transient Ollama error on %s (%s) — retrying in %.1fs",
                    model, msg, delays[attempt],
                )
                time.sleep(delays[attempt])
        raise last_err if last_err else LLMError("unknown error")

    def __enter__(self) -> "OllamaClient":
        return self

    def __exit__(self, *args: object) -> None:
        self._client.close()


def make_client(settings: object) -> OllamaClient:
    model = getattr(settings, "ollama_model", DEFAULT_OLLAMA_MODELS[0])
    base_url = getattr(settings, "ollama_base_url", "http://ollama:11434")
    allowed_raw: str = getattr(settings, "ollama_allowed_models", "") or ""
    allowed = (
        [m.strip() for m in allowed_raw.split(",") if m.strip()]
        if allowed_raw
        else None
    )
    return OllamaClient(
        model=model,
        base_url=base_url,
        allowed_models=allowed,
    )
