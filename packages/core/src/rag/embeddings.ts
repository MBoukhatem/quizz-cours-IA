const BASE_URL = process.env.EMBEDDINGS_BASE_URL ?? 'http://localhost:11436';
const MODEL = process.env.EMBEDDINGS_MODEL ?? 'bge-m3';
const BATCH_SIZE = Number(process.env.EMBEDDINGS_BATCH_SIZE ?? 16);

class EmbeddingError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

interface InfinityResponse {
  object: string;
  data: Array<{ object: string; embedding: number[]; index: number }>;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${BASE_URL}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });

  if (!res.ok) {
    throw new EmbeddingError(res.status, `Embeddings request failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as InfinityResponse;
  return body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const vectors = await embedBatch(batch);
    out.push(...vectors);
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text]);
  return vector;
}
