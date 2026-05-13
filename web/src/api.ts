import type { ModelsResponse, QueryResponse, StatusResponse } from "./types";

const BASE = "";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function getStatus(): Promise<StatusResponse> {
  const res = await fetch(`${BASE}/api/status`);
  return handle<StatusResponse>(res);
}

export async function postQuery(query: string): Promise<QueryResponse> {
  const res = await fetch(`${BASE}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return handle<QueryResponse>(res);
}

export async function postReset(): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/api/reset`, { method: "POST" });
  return handle<{ ok: boolean }>(res);
}

export async function postIngest(
  file: File
): Promise<{ ok: boolean; filename: string; chunks: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/ingest`, {
    method: "POST",
    body: form,
  });
  return handle(res);
}

export async function setModel(model: string): Promise<ModelsResponse> {
  const res = await fetch(`${BASE}/api/models`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  return handle<ModelsResponse>(res);
}
