import type { CitationDTO, SearchResultItemDTO } from '@documind/shared';

const MAX_PENDING_BRACKET_LENGTH = 16;

/**
 * Tracks inline bracket citations (e.g., [1], [2]) across streamed LLM token
 * deltas, buffering partial markers and emitting each valid CitationDTO once.
 */
export class CitationTracker {
  private readonly chunks: SearchResultItemDTO[];
  private readonly emittedIndices = new Set<number>();
  private readonly emittedCitations: CitationDTO[] = [];
  private buffer = '';

  constructor(chunks: SearchResultItemDTO[]) {
    this.chunks = chunks;
  }

  /**
   * Processes a streamed text delta and returns any newly detected valid citations.
   */
  processDelta(delta: string): CitationDTO[] {
    if (!delta) {
      return [];
    }

    this.buffer += delta;
    const newlyEmitted: CitationDTO[] = [];

    while (this.buffer.length > 0) {
      const openIdx = this.buffer.indexOf('[');
      if (openIdx === -1) {
        this.buffer = '';
        break;
      }

      const closeIdx = this.buffer.indexOf(']', openIdx + 1);
      if (closeIdx === -1) {
        this.buffer = this.buffer.slice(openIdx);
        // Prevent unbounded buffering on unclosed '[' that cannot be a numeric citation
        if (
          this.buffer.length > MAX_PENDING_BRACKET_LENGTH ||
          !/^\[\d*$/.test(this.buffer)
        ) {
          const nextOpen = this.buffer.indexOf('[', 1);
          this.buffer = nextOpen === -1 ? '' : this.buffer.slice(nextOpen);
        }
        break;
      }

      const inner = this.buffer.slice(openIdx + 1, closeIdx);
      const nestedOpenIdx = inner.indexOf('[');
      if (nestedOpenIdx !== -1) {
        this.buffer = this.buffer.slice(openIdx + 1 + nestedOpenIdx);
        continue;
      }

      this.buffer = this.buffer.slice(closeIdx + 1);

      if (!/^\d+$/.test(inner)) {
        continue;
      }

      const index = Number.parseInt(inner, 10);
      if (index < 1 || index > this.chunks.length || this.emittedIndices.has(index)) {
        continue;
      }

      const chunk = this.chunks[index - 1];
      const citation: CitationDTO = {
        index,
        badge: `[${index}]`,
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        fileType: chunk.fileType,
        similarity: chunk.semanticScore ?? chunk.score,
        coordinates: chunk.coordinates,
        excerpt: chunk.snippet || chunk.content.slice(0, 240),
      };

      this.emittedIndices.add(index);
      this.emittedCitations.push(citation);
      newlyEmitted.push(citation);
    }

    return newlyEmitted;
  }

  /**
   * Returns all unique citations emitted so far in order of first appearance.
   */
  getEmittedCitations(): CitationDTO[] {
    return [...this.emittedCitations];
  }
}
