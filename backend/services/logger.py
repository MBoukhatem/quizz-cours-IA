"""JSON audit logger writing one file per day in /data/logs/."""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from typing import Any, Optional

from config import get_settings


class AuditLogger:
    """Append-only JSON-lines logger. One file per UTC day."""

    def __init__(self, log_dir: str) -> None:
        self.log_dir = log_dir
        self._lock = threading.Lock()
        os.makedirs(self.log_dir, exist_ok=True)

    def _path_for_today(self) -> str:
        day = datetime.utcnow().strftime("%Y-%m-%d")
        return os.path.join(self.log_dir, f"audit-{day}.jsonl")

    def info(
        self,
        event_type: str,
        session_id: Optional[str] = None,
        extra_data: Optional[dict[str, Any]] = None,
    ) -> None:
        record = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "session_id": session_id,
            "event_type": event_type,
            "data": extra_data or {},
        }
        line = json.dumps(record, ensure_ascii=False)
        path = self._path_for_today()
        with self._lock:
            with open(path, "a", encoding="utf-8") as fh:
                fh.write(line + "\n")


_logger: Optional[AuditLogger] = None
_logger_lock = threading.Lock()


def get_audit_logger() -> AuditLogger:
    global _logger
    if _logger is None:
        with _logger_lock:
            if _logger is None:
                _logger = AuditLogger(get_settings().log_dir)
    return _logger
