import { describe, it, expect } from 'vitest';
import { chunkDocumentContent } from '../src/features/chunking/chunker.service.js';
import type { ExtractedSegment } from '../src/features/extractors/extractor.types.js';

describe('Milestone 1.7: Recursive Character Chunker', () => {
  it('defaults to 600-char chunks with 100-char overlap and inherits segment coordinates', () => {
    const paragraphA = 'First paragraph sentence one. '.repeat(12).trim(); // ~360 chars
    const paragraphB = 'Second paragraph sentence two. '.repeat(14).trim(); // ~434 chars
    const segments: ExtractedSegment[] = [
      {
        content: `${paragraphA}\n\n${paragraphB}`,
        coordinates: { pageNumber: 4 },
      },
    ];

    const chunks = chunkDocumentContent(segments);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.every((c) => c.content.length <= 600)).toBe(true);
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
    expect(chunks.every((c) => c.coordinates.pageNumber === 4)).toBe(true);
    expect(chunks.every((c) => c.tokenCount > 0)).toBe(true);
  });

  it('prefers paragraph, line, and sentence boundaries over mid-word splits and carries overlap', () => {
    const sentences = Array.from(
      { length: 10 },
      (_, i) => `Sentence number ${i + 1} provides important financial context.`
    ).join(' ');
    const segments: ExtractedSegment[] = [
      {
        content: sentences,
        coordinates: { sheetName: 'Summary', rowStart: 1, rowEnd: 20 },
      },
    ];

    const chunks = chunkDocumentContent(segments, { chunkSize: 220, chunkOverlap: 60 });

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0].coordinates).toEqual({ sheetName: 'Summary', rowStart: 1, rowEnd: 20 });
    // Overlap check: trailing text of chunk[0] should appear at the start of chunk[1]
    const tail = chunks[0].content.slice(-40);
    expect(chunks[1].content).toContain(tail);
  });

  it('handles continuous tokens exceeding chunkSize and skips empty segments', () => {
    const segments: ExtractedSegment[] = [
      { content: '   \n\n  ', coordinates: { slideNumber: 1 } },
      { content: 'X'.repeat(1300), coordinates: { slideNumber: 2 } },
    ];

    const chunks = chunkDocumentContent(segments, { chunkSize: 500, chunkOverlap: 50 });

    expect(chunks.length).toBe(3);
    expect(chunks.every((c) => c.content.length <= 500)).toBe(true);
    expect(chunks.every((c) => c.coordinates.slideNumber === 2)).toBe(true);
  });

  it('rejects invalid overlap >= chunkSize', () => {
    expect(() =>
      chunkDocumentContent([{ content: 'hello', coordinates: { pageNumber: 1 } }], {
        chunkSize: 100,
        chunkOverlap: 100,
      })
    ).toThrow(/overlap/i);
  });
});
