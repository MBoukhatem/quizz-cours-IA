from __future__ import annotations

import logging
import threading
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    pass


# Default allowlist of free-tier Gemini Flash models.
# Surfaced to the UI and used as the source of truth for what is selectable.
DEFAULT_FLASH_MODELS: list[str] = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-flash-lite-latest",
]


def _to_gemini_messages(messages: list[dict]) -> tuple[Optional[str], list[dict]]:
    """Translate OpenAI-style messages to Gemini's (system_instruction, contents).

    - role "system" is merged into Gemini's top-level `system_instruction`.
    - role "user"/"assistant" become contents with role "user"/"model".
    """
    system_parts: list[str] = []
    contents: list[dict] = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if not isinstance(content, str):
            content = str(content)
        if role == "system":
            system_parts.append(content)
            continue
        gemini_role = "model" if role == "assistant" else "user"
        contents.append({"role": gemini_role, "parts": [{"text": content}]})

    system_instruction = "\n\n".join(system_parts) if system_parts else None
    return system_instruction, contents


class GeminiClient:
    """Google AI Studio (Generative Language API) client.

    Preserves the same surface as the previous OpenRouter client so that all
    callers (router, rag agent, tools agent, quiz_generator) stay unchanged.
    """

    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str = "https://generativelanguage.googleapis.com/v1beta",
        allowed_models: Optional[list[str]] = None,
    ) -> None:
        if not api_key:
            raise LLMError("GEMINI_API_KEY is missing")
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._default_model = model
        self._current_model = model
        self._allowed = list(allowed_models) if allowed_models else list(DEFAULT_FLASH_MODELS)
        self._lock = threading.Lock()
        self._client = httpx.Client(timeout=60.0)

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
        logger.info("Active Gemini model set to %s", model)
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
        system_instruction, contents = _to_gemini_messages(messages)

        body: dict = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        if system_instruction:
            body["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        # Map OpenAI-style {"type": "json_object"} to Gemini JSON mime
        if response_format and response_format.get("type") == "json_object":
            body["generationConfig"]["responseMimeType"] = "application/json"

        url = f"{self._base_url}/models/{model}:generateContent"
        params = {"key": self._api_key}

        try:
            resp = self._client.post(url, params=params, json=body)
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            raise LLMError(f"network: {exc}") from exc

        if resp.status_code == 429:
            raise LLMError(f"rate_limited: {model}")
        if resp.status_code == 401 or resp.status_code == 403:
            raise LLMError(f"auth error on {model}: check GEMINI_API_KEY")
        if resp.status_code == 404:
            raise LLMError(f"model not found: {model}")
        if resp.status_code >= 500:
            raise LLMError(f"upstream {resp.status_code} on {model}")
        if resp.status_code >= 400:
            raise LLMError(f"http {resp.status_code} on {model}: {resp.text[:200]}")

        data = resp.json()
        candidates = data.get("candidates") or []
        if not candidates:
            # blocked by safety, or empty — surface useful info
            reason = data.get("promptFeedback", {}).get("blockReason") or "empty"
            raise LLMError(f"no candidates from {model} ({reason})")

        parts = candidates[0].get("content", {}).get("parts") or []
        texts = [p.get("text", "") for p in parts if isinstance(p, dict)]
        text = "".join(texts).strip()
        if not text:
            finish = candidates[0].get("finishReason", "?")
            raise LLMError(f"empty response from {model} (finishReason={finish})")
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

        We respect the user's model choice — no silent fallback to another
        model. But transient upstream errors (429 rate-limit, 5xx) get a small
        exponential backoff before giving up, so a single hiccup doesn't
        surface as a failed quiz.
        """
        model = self.current_model
        delays = [1.0, 3.0]  # two retries: 1s then 3s
        last_err: Optional[LLMError] = None
        for attempt in range(len(delays) + 1):
            try:
                return self._do_request(
                    model, messages, temperature, max_tokens, response_format
                )
            except LLMError as exc:
                last_err = exc
                msg = str(exc)
                transient = (
                    msg.startswith("rate_limited")
                    or msg.startswith("upstream ")
                    or msg.startswith("network:")
                )
                if not transient or attempt >= len(delays):
                    logger.warning("Gemini call failed on %s: %s", model, msg)
                    raise
                logger.info(
                    "Transient Gemini error on %s (%s) — retrying in %.1fs",
                    model, msg, delays[attempt],
                )
                time.sleep(delays[attempt])
        # unreachable, but keep mypy happy
        raise last_err if last_err else LLMError("unknown error")

    def __enter__(self) -> "GeminiClient":
        return self

    def __exit__(self, *args: object) -> None:
        self._client.close()


def make_client(settings: object) -> GeminiClient:
    api_key = getattr(settings, "gemini_api_key", "") or ""
    model = getattr(settings, "gemini_model", DEFAULT_FLASH_MODELS[0])
    base_url = getattr(
        settings, "gemini_base_url", "https://generativelanguage.googleapis.com/v1beta"
    )
    allowed_raw: str = getattr(settings, "gemini_allowed_models", "") or ""
    allowed = (
        [m.strip() for m in allowed_raw.split(",") if m.strip()]
        if allowed_raw
        else None
    )
    return GeminiClient(
        api_key=api_key,
        model=model,
        base_url=base_url,
        allowed_models=allowed,
    )
