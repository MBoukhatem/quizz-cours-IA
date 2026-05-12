import fs from 'node:fs';
import path from 'node:path';
import Database, { type Database as DatabaseType, type Statement } from 'better-sqlite3';

const DDL = `
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id              TEXT    PRIMARY KEY,
  thread_id       TEXT    NOT NULL,
  quiz_json       TEXT    NOT NULL,
  created_at      INTEGER NOT NULL,
  submitted_at    INTEGER,
  answers_json    TEXT,
  evaluation_json TEXT,
  score           REAL
);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_thread_id  ON quiz_sessions (thread_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_created_at ON quiz_sessions (created_at DESC);
`;

export interface SessionRow {
  id: string;
  threadId: string;
  quizJson: string;
  createdAt: number;
  submittedAt: number | null;
  answersJson: string | null;
  evaluationJson: string | null;
  score: number | null;
}

interface RawRow {
  id: string;
  thread_id: string;
  quiz_json: string;
  created_at: number;
  submitted_at: number | null;
  answers_json: string | null;
  evaluation_json: string | null;
  score: number | null;
}

function toRow(raw: RawRow): SessionRow {
  return {
    id: raw.id,
    threadId: raw.thread_id,
    quizJson: raw.quiz_json,
    createdAt: raw.created_at,
    submittedAt: raw.submitted_at,
    answersJson: raw.answers_json,
    evaluationJson: raw.evaluation_json,
    score: raw.score,
  };
}

export class SessionStore {
  private readonly db: DatabaseType;
  private readonly stmtInsert: Statement;
  private readonly stmtSubmit: Statement;
  private readonly stmtGetById: Statement;
  private readonly stmtListByThread: Statement;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? process.env.SQLITE_PATH ?? './data/memory.db';
    const dir = path.dirname(resolvedPath);
    fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(resolvedPath);
    this.db.exec(DDL);

    this.stmtInsert = this.db.prepare(
      `INSERT INTO quiz_sessions (id, thread_id, quiz_json, created_at)
       VALUES (@id, @threadId, @quizJson, @createdAt)`,
    );

    this.stmtSubmit = this.db.prepare(
      `UPDATE quiz_sessions
       SET submitted_at = @submittedAt,
           answers_json = @answersJson,
           evaluation_json = @evaluationJson,
           score = @score
       WHERE id = @id`,
    );

    this.stmtGetById = this.db.prepare(
      `SELECT * FROM quiz_sessions WHERE id = ?`,
    );

    this.stmtListByThread = this.db.prepare(
      `SELECT * FROM quiz_sessions
       WHERE thread_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    );
  }

  createSession(input: { threadId: string; quiz: unknown }): string {
    const id = crypto.randomUUID();
    this.stmtInsert.run({
      id,
      threadId: input.threadId,
      quizJson: JSON.stringify(input.quiz),
      createdAt: Date.now(),
    });
    return id;
  }

  submitAnswers(input: {
    sessionId: string;
    answers: unknown;
    evaluation: unknown;
    score: number;
  }): void {
    this.stmtSubmit.run({
      id: input.sessionId,
      submittedAt: Date.now(),
      answersJson: JSON.stringify(input.answers),
      evaluationJson: JSON.stringify(input.evaluation),
      score: input.score,
    });
  }

  getSession(id: string): SessionRow | undefined {
    const raw = this.stmtGetById.get(id) as RawRow | undefined;
    return raw ? toRow(raw) : undefined;
  }

  listByThread(threadId: string, limit = 20): SessionRow[] {
    const rows = this.stmtListByThread.all(threadId, limit) as RawRow[];
    return rows.map(toRow);
  }
}
