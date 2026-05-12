import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { loadDocument, chunkDocument, embedTexts, QdrantStore } from '@quizz/core';

const UPLOAD_DIR = './data/uploads';
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.md', '.txt']);

function ensureUploadDir(): void {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function isAllowedExtension(filename: string): boolean {
  return ALLOWED_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

interface IngestEntry {
  source: string;
  chunks: number;
}

export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.post('/ingest', async (req, reply) => {
    ensureUploadDir();

    const parts = req.files();
    const ingested: IngestEntry[] = [];
    const store = new QdrantStore();

    for await (const part of parts) {
      const originalName = part.filename ?? 'upload';

      if (!isAllowedExtension(originalName)) {
        // consume stream to avoid multipart parsing errors, then skip
        await part.toBuffer();
        req.log.warn({ filename: originalName }, 'rejected file: unsupported extension');
        continue;
      }

      const savedName = `${randomUUID()}_${originalName}`;
      const savedPath = path.join(UPLOAD_DIR, savedName);
      await new Promise<void>((resolve, reject) => {
        const out = fs.createWriteStream(savedPath);
        part.file.on('error', reject);
        out.on('error', reject);
        out.on('finish', () => resolve());
        part.file.pipe(out);
      });

      req.log.info({ savedPath, originalName }, 'file saved, starting ingestion');

      const doc = await loadDocument(savedPath);
      doc.meta.source = originalName;
      const chunks = await chunkDocument(doc);
      const texts = chunks.map((c) => c.text);
      const vectors = await embedTexts(texts);

      const dim = vectors[0]?.length ?? 1024;
      await store.ensureCollection(dim);

      await store.upsert(
        chunks.map((chunk, i) => ({
          id: chunk.id,
          vector: vectors[i] as number[],
          payload: chunk.payload,
        })),
      );

      req.log.info({ source: doc.meta.source, chunks: chunks.length }, 'ingestion complete');
      ingested.push({ source: originalName, chunks: chunks.length });
    }

    return reply.send({ ingested });
  });
}
