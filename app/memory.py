from __future__ import annotations


class ConversationMemory:
    def __init__(self, max_turns: int = 5) -> None:
        self._max_turns = max_turns
        self._messages: list[dict] = []

    def add(self, role: str, content: str) -> None:
        self._messages.append({"role": role, "content": content})
        # keep the last 2*max_turns messages (user+assistant pairs)
        max_len = self._max_turns * 2
        if len(self._messages) > max_len:
            self._messages = self._messages[-max_len:]

    def history(self) -> list[dict]:
        return list(self._messages)

    def as_messages(self) -> list[dict]:
        return list(self._messages)

    def clear(self) -> None:
        self._messages = []
