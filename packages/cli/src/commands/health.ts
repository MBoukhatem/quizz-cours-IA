const vllmBase = (process.env.VLLM_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const vllmModels = vllmBase.endsWith("/v1") ? `${vllmBase}/models` : `${vllmBase}/v1/models`;

const SERVICES = [
  {
    name: "vLLM",
    url: vllmModels,
    headers: process.env.VLLM_API_KEY ? { Authorization: `Bearer ${process.env.VLLM_API_KEY}` } : {},
  },
  {
    name: "Infinity",
    url: (process.env.EMBEDDINGS_BASE_URL ?? "http://localhost:11436") + "/models",
    headers: {},
  },
  {
    name: "Qdrant",
    url: (process.env.QDRANT_URL ?? "http://localhost:6333") + "/",
    headers: {},
  },
] as const;

interface ProbeResult {
  name: string;
  url: string;
  ok: boolean;
  status: number | null;
  ms: number;
}

async function probe(
  name: string,
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { method: "GET", headers, signal: controller.signal });
    clearTimeout(timer);
    return { name, url, ok: res.ok, status: res.status, ms: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return { name, url, ok: false, status: null, ms: Date.now() - start };
  }
}

function pad(s: string, n: number): string {
  return s.padEnd(n, " ");
}

export async function runHealth(): Promise<void> {
  const results = await Promise.all(
    SERVICES.map((s) => probe(s.name, s.url, s.headers, 1500)),
  );

  const header = `${pad("Service", 10)} ${pad("Status", 8)} ${pad("HTTP", 6)} ${pad("Latency", 10)} URL`;
  const separator = "-".repeat(header.length);

  console.log(separator);
  console.log(header);
  console.log(separator);

  for (const r of results) {
    const status = r.ok ? "UP" : "DOWN";
    const httpCode = r.status !== null ? String(r.status) : "---";
    const latency = r.ok ? `${r.ms}ms` : "---";
    console.log(
      `${pad(r.name, 10)} ${pad(status, 8)} ${pad(httpCode, 6)} ${pad(latency, 10)} ${r.url}`
    );
  }

  console.log(separator);

  const allOk = results.every((r) => r.ok);
  if (!allOk) {
    process.exitCode = 1;
  }
}
