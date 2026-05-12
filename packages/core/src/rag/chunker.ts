import { createHash } from 'node:crypto';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { LoadedDoc } from './loader.js';

export interface ChunkPayload {
  source: string;
  mime: string;
  page?: number;
  chunkIndex: number;
  text: string;
}

export interface Chunk {
  id: string;
  text: string;
  payload: ChunkPayload;
}

function stableId(source: string, chunkIndex: number): string {
  const h = createHash('sha1').update(`${source}::${chunkIndex}`).digest('hex').slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export async function chunkDocument(
  doc: LoadedDoc,
  opts?: { size?: number; overlap?: number },
): Promise<Chunk[]> {
  const chunkSize = opts?.size ?? Number(process.env.CHUNK_SIZE ?? 800);
  const chunkOverlap = opts?.overlap ?? Number(process.env.CHUNK_OVERLAP ?? 120);

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });
  const chunks: Chunk[] = [];
  let globalIndex = 0;

  if (doc.pages && doc.pages.length > 0) {
    for (const { page, text } of doc.pages) {
      const splits = await splitter.splitText(text);
      for (const split of splits) {
        chunks.push({
          id: stableId(doc.meta.source, globalIndex),
          text: split,
          payload: {
            source: doc.meta.source,
            mime: doc.meta.mime,
            page,
            chunkIndex: globalIndex,
            text: split,
          },
        });
        globalIndex++;
      }
    }
  } else {
    const splits = await splitter.splitText(doc.text);
    for (const split of splits) {
      chunks.push({
        id: stableId(doc.meta.source, globalIndex),
        text: split,
        payload: {
          source: doc.meta.source,
          mime: doc.meta.mime,
          chunkIndex: globalIndex,
          text: split,
        },
      });
      globalIndex++;
    }
  }

  return chunks;
}
