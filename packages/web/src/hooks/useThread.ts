import { useState, useCallback } from 'react';

const STORAGE_KEY = 'quizz.threadId';

function generateUuid(): string {
  // crypto.randomUUID is available in all modern browsers (and Vite's target)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreate(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const id = generateUuid();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}

export interface UseThreadResult {
  threadId: string;
  reset: () => void;
}

export function useThread(): UseThreadResult {
  const [threadId, setThreadId] = useState<string>(() => getOrCreate());

  const reset = useCallback(() => {
    const id = generateUuid();
    localStorage.setItem(STORAGE_KEY, id);
    setThreadId(id);
  }, []);

  return { threadId, reset };
}
