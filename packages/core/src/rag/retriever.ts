import { embedQuery } from './embeddings.js';
import { QdrantStore, type Filter } from './qdrant.js';

export interface RetrievalResult {
  id: string;
  score: number;
  text: string;
  citation: { source: string; page?: number; chunkIndex: number };
}

const store = new QdrantStore();

export async function retrieve(
  query: string,
  opts?: { topK?: number; sourceFilter?: string },
): Promise<RetrievalResult[]> {
  const topK = opts?.topK ?? Number(process.env.RETRIEVAL_TOP_K ?? 5);

  const filter: Filter | undefined = opts?.sourceFilter
    ? { must: [{ key: 'source', match: { value: opts.sourceFilter } }] }
    : undefined;

  const vector = await embedQuery(query);
  const hits = await store.search(vector, topK, filter);

  return hits.map((h) => ({
    id: String(h.id),
    score: h.score,
    text: h.payload.text,
    citation: {
      source: h.payload.source,
      page: h.payload.page,
      chunkIndex: h.payload.chunkIndex,
    },
  }));
}
