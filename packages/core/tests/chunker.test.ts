import { describe, it, expect } from "vitest";
import { chunkDocument } from "../src/rag/chunker.js";
import type { LoadedDoc } from "../src/rag/loader.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSinglePageDoc(text: string, source = "test.md"): LoadedDoc {
  return {
    text,
    meta: { source, mime: "text/markdown" },
  };
}

function makeMultiPageDoc(pages: Array<{ page: number; text: string }>, source = "test.pdf"): LoadedDoc {
  return {
    text: pages.map((p) => p.text).join("\n"),
    pages,
    meta: { source, mime: "application/pdf" },
  };
}

const LOREM =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. " +
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris. ";

// Repeat to guarantee multiple chunks at small size
const LONG_TEXT = LOREM.repeat(30);

// ---------------------------------------------------------------------------
// Single-page (no pages array)
// ---------------------------------------------------------------------------

describe("chunkDocument — single-page text doc", () => {
  it("produces at least one chunk", async () => {
    const doc = makeSinglePageDoc(LONG_TEXT);
    const chunks = await chunkDocument(doc, { size: 200, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("each chunk has a non-empty stable id of 16 hex characters", async () => {
    const doc = makeSinglePageDoc(LONG_TEXT);
    const chunks = await chunkDocument(doc, { size: 200, overlap: 20 });
    for (const chunk of chunks) {
      expect(chunk.id).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it("chunk ids are stable across two calls with the same source", async () => {
    const doc = makeSinglePageDoc(LONG_TEXT, "stable.md");
    const run1 = await chunkDocument(doc, { size: 200, overlap: 20 });
    const run2 = await chunkDocument(doc, { size: 200, overlap: 20 });
    expect(run1.map((c) => c.id)).toEqual(run2.map((c) => c.id));
  });

  it("payload contains a non-empty text field matching chunk.text", async () => {
    const doc = makeSinglePageDoc(LONG_TEXT);
    const chunks = await chunkDocument(doc, { size: 200, overlap: 20 });
    for (const chunk of chunks) {
      expect(chunk.payload.text).toBe(chunk.text);
      expect(chunk.text.length).toBeGreaterThan(0);
    }
  });

  it("payload has no 'page' field for a flat document", async () => {
    const doc = makeSinglePageDoc(LONG_TEXT);
    const chunks = await chunkDocument(doc, { size: 200, overlap: 20 });
    for (const chunk of chunks) {
      expect(chunk.payload.page).toBeUndefined();
    }
  });

  it("chunkIndex is monotonically increasing from 0", async () => {
    const doc = makeSinglePageDoc(LONG_TEXT);
    const chunks = await chunkDocument(doc, { size: 200, overlap: 20 });
    chunks.forEach((chunk, i) => {
      expect(chunk.payload.chunkIndex).toBe(i);
    });
  });

  it("handles a very short input without throwing (small overlap edge case)", async () => {
    const doc = makeSinglePageDoc("Bonjour.");
    const chunks = await chunkDocument(doc, { size: 800, overlap: 120 });
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].text).toBeTruthy();
  });

  it("source in payload matches the doc meta source", async () => {
    const doc = makeSinglePageDoc(LONG_TEXT, "cours_python.md");
    const chunks = await chunkDocument(doc, { size: 200, overlap: 20 });
    for (const chunk of chunks) {
      expect(chunk.payload.source).toBe("cours_python.md");
    }
  });
});

// ---------------------------------------------------------------------------
// Multi-page (pages array present)
// ---------------------------------------------------------------------------

describe("chunkDocument — multi-page doc", () => {
  const pages = [
    { page: 1, text: LOREM.repeat(5) },
    { page: 2, text: LOREM.repeat(5) },
    { page: 3, text: LOREM.repeat(5) },
  ];

  it("each chunk's payload.page matches the source page", async () => {
    const doc = makeMultiPageDoc(pages);
    const chunks = await chunkDocument(doc, { size: 200, overlap: 20 });

    for (const chunk of chunks) {
      expect(chunk.payload.page).toBeDefined();
      // page must be one of 1, 2, 3
      expect([1, 2, 3]).toContain(chunk.payload.page);
    }
  });

  it("chunks from page 1 appear before chunks from page 3", async () => {
    const doc = makeMultiPageDoc(pages);
    const chunks = await chunkDocument(doc, { size: 200, overlap: 20 });

    const firstPage1Idx = chunks.findIndex((c) => c.payload.page === 1);
    const firstPage3Idx = chunks.findIndex((c) => c.payload.page === 3);
    expect(firstPage1Idx).toBeGreaterThanOrEqual(0);
    expect(firstPage3Idx).toBeGreaterThan(firstPage1Idx);
  });

  it("chunkIndex is globally monotonically increasing across all pages", async () => {
    const doc = makeMultiPageDoc(pages);
    const chunks = await chunkDocument(doc, { size: 200, overlap: 20 });

    chunks.forEach((chunk, i) => {
      expect(chunk.payload.chunkIndex).toBe(i);
    });
  });

  it("produces chunks from all three pages", async () => {
    const doc = makeMultiPageDoc(pages);
    const chunks = await chunkDocument(doc, { size: 200, overlap: 20 });

    const pagesFound = new Set(chunks.map((c) => c.payload.page));
    expect(pagesFound.has(1)).toBe(true);
    expect(pagesFound.has(2)).toBe(true);
    expect(pagesFound.has(3)).toBe(true);
  });
});
