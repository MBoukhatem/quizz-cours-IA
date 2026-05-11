"""pytest fixtures shared across test modules."""
from __future__ import annotations

import os
import sys

import pytest

# Make backend/ importable when tests are launched from anywhere.
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)


@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    """Initialise a clean SQLite database in a tmp path for each test."""
    from models import database as db

    path = tmp_path / "test.db"
    db._DB_PATH = None  # reset module state
    db.init_db(str(path))
    yield str(path)
    db._DB_PATH = None
