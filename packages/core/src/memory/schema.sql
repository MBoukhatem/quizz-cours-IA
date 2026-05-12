CREATE TABLE IF NOT EXISTS quiz_sessions (
  id           TEXT    PRIMARY KEY,
  thread_id    TEXT    NOT NULL,
  quiz_json    TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  submitted_at INTEGER,
  answers_json TEXT,
  evaluation_json TEXT,
  score        REAL
);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_thread_id
  ON quiz_sessions (thread_id);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_created_at
  ON quiz_sessions (created_at DESC);
