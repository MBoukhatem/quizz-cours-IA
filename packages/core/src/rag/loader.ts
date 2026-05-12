import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface LoadedDoc {
  text: string;
  pages?: Array<{ page: number; text: string }>;
  meta: { source: string; mime: string };
}

export async function loadDocument(filePath: string): Promise<LoadedDoc> {
  const ext = path.extname(filePath).toLowerCase();
  const source = path.basename(filePath);

  if (ext === '.pdf') {
    const { extractText } = await import('unpdf');
    const buffer = await fs.readFile(filePath);
    // unpdf returns { text, totalPages } or similar; cast via unknown for adapter boundary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await extractText(new Uint8Array(buffer), { mergePages: false })) as any;

    if (Array.isArray(result.text)) {
      const pages = (result.text as string[]).map((t, i) => ({ page: i + 1, text: t }));
      return {
        text: pages.map((p) => p.text).join('\n'),
        pages,
        meta: { source, mime: 'application/pdf' },
      };
    }

    return {
      text: typeof result.text === 'string' ? result.text : String(result),
      meta: { source, mime: 'application/pdf' },
    };
  }

  if (ext === '.docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return { text: result.value, meta: { source, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } };
  }

  if (ext === '.md' || ext === '.txt') {
    const mime = ext === '.md' ? 'text/markdown' : 'text/plain';
    const text = await fs.readFile(filePath, 'utf-8');
    return { text, meta: { source, mime } };
  }

  throw new Error(`Unsupported file extension: ${ext}`);
}
