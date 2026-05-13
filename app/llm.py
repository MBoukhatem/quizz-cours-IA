from __future__ import annotations

from typing import Optional

import httpx


class LLMError(RuntimeError):
    pass


class OpenRouterClient:
    def __init__(
        self,
        api_key: str,
        model: str,
        fallback_model: str,
        base_url: str,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._fallback_model = fallback_model
        self._base_url = base_url.rstrip("/")
        self._client = httpx.Client(timeout=60.0)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/quizz-cours-ia",
            "X-Title": "quizz-cours-IA",
        }

    def _do_request(
        self,
        model: str,
        messages: list[dict],
        temperature: float,
        max_tokens: int,
        response_format: Optional[dict],
    ) -> str:
        body: dict = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format is not None:
            body["response_format"] = response_format

        try:
            resp = self._client.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json=body,
            )
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            raise LLMError(str(exc)) from exc

        if resp.status_code >= 500:
            raise LLMError(f"upstream {resp.status_code}: {resp.text}")

        data = resp.json()
        if "choices" not in data:
            raise LLMError(f"missing 'choices' in response: {data}")

        return data["choices"][0]["message"]["content"]

    def chat(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.2,
        response_format: Optional[dict] = None,
        max_tokens: int = 2048,
    ) -> str:
        try:
            return self._do_request(
                self._model, messages, temperature, max_tokens, response_format
            )
        except LLMError:
            # single retry with fallback model
            return self._do_request(
                self._fallback_model, messages, temperature, max_tokens, response_format
            )

    def __enter__(self) -> OpenRouterClient:
        return self

    def __exit__(self, *args: object) -> None:
        self._client.close()


def make_client(settings: object) -> OpenRouterClient:
    return OpenRouterClient(
        api_key=settings.openrouter_api_key,  # type: ignore[attr-defined]
        model=settings.openrouter_model,  # type: ignore[attr-defined]
        fallback_model=settings.openrouter_fallback_model,  # type: ignore[attr-defined]
        base_url=settings.openrouter_base_url,  # type: ignore[attr-defined]
    )
