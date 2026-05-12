import fs from 'node:fs';
import path from 'node:path';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';

/**
 * Creates a LangGraph SQLite checkpointer.
 * The parent directory is created if it does not exist.
 * `SqliteSaver.fromConnString` wraps better-sqlite3 synchronously;
 * setup() is called lazily inside each public method.
 */
export function createCheckpointer(dbPath?: string): SqliteSaver {
  const resolvedPath = dbPath ?? process.env.SQLITE_PATH ?? './data/memory.db';
  const dir = path.dirname(resolvedPath);
  fs.mkdirSync(dir, { recursive: true });
  return SqliteSaver.fromConnString(resolvedPath);
}
