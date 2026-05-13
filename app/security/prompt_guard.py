from __future__ import annotations

import unicodedata

INJECTION_PATTERNS: list[str] = [
    "ignore previous instructions",
    "ignore previous",
    "disregard previous",
    "ignore les instructions",
    "ignore les consignes",
    "tu es maintenant",
    "you are now",
    "system:",
    "système:",
    "[system]",
    "reveal the system prompt",
    "révèle le prompt système",
    "override your instructions",
    "forget your instructions",
    "oublie tes instructions",
    "oublie les instructions",
]


def _normalize(text: str) -> str:
    return unicodedata.normalize("NFC", text).lower()


def is_injection(text: str) -> tuple[bool, str | None]:
    normalized = _normalize(text)
    for pattern in INJECTION_PATTERNS:
        if pattern in normalized:
            return True, pattern
    return False, None


def sanitize_user_input(text: str, max_len: int = 4000) -> str:
    text = text[:max_len]
    # strip control chars except \n and \t
    text = "".join(
        ch for ch in text if ch in ("\n", "\t") or ord(ch) >= 0x20
    )
    detected, matched = is_injection(text)
    if detected and matched is not None:
        normalized = _normalize(text)
        # replace matched pattern preserving original case by working on lowercased copy
        lower = text.lower()
        result = lower.replace(matched, "[REDACTED]")
        # restore capitalisation for non-replaced parts is not feasible character-by-character;
        # the spec only requires the replacement, so we prepend the note on the lowercased result
        text = result
        text = "[USER NOTE - request sanitized] " + text
    return text
