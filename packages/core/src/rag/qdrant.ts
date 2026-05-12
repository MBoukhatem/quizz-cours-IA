import { QdrantClient } from '@qdrant/js-client-rest';
import type { ChunkPayload } from './chunker.js';

export type { ChunkPayload };

export interface Filter {
  must?: Array<{ key: string; match: { value: string | number | boolean } }>;
}

export interface SearchHit {
  id: string | number;
  score: number;
  payload: ChunkPayload;
}

export class QdrantStore {
  private readonly url: string;
  private readonly collection: string;
  private _client: QdrantClient | null = null;

  constructor(opts?: { url?: string; collection?: string }) {
    this.url = opts?.url ?? process.env.QDRANT_URL ?? 'http://localhost:6333';
    this.collection = opts?.collection ?? process.env.QDRANT_COLLECTION ?? 'quiz_cours';
  }

  private get client(): QdrantClient {
    if (!this._client) {
      this._client = new QdrantClient({ url: this.url });
    }
    return this._client;
  }

  async ensureCollection(dim: number): Promise<void> {
    const exists = await this.client.collectionExists(this.collection);
    if (!exists.exists) {
      await this.client.createCollection(this.collection, {
        vectors: { size: dim, distance: 'Cosine' },
      });
      await this.client.createPayloadIndex(this.collection, {
        field_name: 'source',
        field_schema: 'keyword',
      });
    }
  }

  async upsert(
    points: Array<{ id: string | number; vector: number[]; payload: ChunkPayload }>,
  ): Promise<void> {
    const batchSize = Number(process.env.QDRANT_UPSERT_BATCH ?? 256);
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      await this.client.upsert(this.collection, {
        wait: true,
        points: batch.map((p) => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload as unknown as Record<string, unknown>,
        })),
      });
    }
  }

  async search(vector: number[], topK: number, filter?: Filter): Promise<SearchHit[]> {
    const results = await this.client.search(this.collection, {
      vector,
      limit: topK,
      with_payload: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filter: filter as any,
    });

    return results.map((r) => ({
      id: r.id,
      score: r.score,
      payload: r.payload as unknown as ChunkPayload,
    }));
  }
}
