import path from "node:path";
import {
  loadDocument,
  chunkDocument,
  embedTexts,
  QdrantStore,
} from "@quizz/core";

export async function runIngest(files: string[]): Promise<void> {
  const store = new QdrantStore();

  for (const filePath of files) {
    const resolved = path.resolve(filePath);
    const source = path.basename(resolved);

    process.stdout.write(`[ingest] ${source} — loading…\n`);

    let doc;
    try {
      doc = await loadDocument(resolved);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[ingest] ${source} — error loading: ${message}\n`);
      continue;
    }

    const chunks = await chunkDocument(doc);
    process.stdout.write(
      `[ingest] ${source} — ${chunks.length} chunks, embedding…\n`
    );

    const texts = chunks.map((c) => c.text);
    let vectors: number[][];
    try {
      vectors = await embedTexts(texts);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[ingest] ${source} — error embedding: ${message}\n`
      );
      continue;
    }

    const dim = vectors[0]?.length ?? 0;
    await store.ensureCollection(dim);

    const points = chunks.map((chunk, i) => ({
      id: chunk.id,
      vector: vectors[i],
      payload: chunk.payload,
    }));

    await store.upsert(points);

    process.stdout.write(`[ingest] ${source} → ${chunks.length} chunks\n`);
  }
}
