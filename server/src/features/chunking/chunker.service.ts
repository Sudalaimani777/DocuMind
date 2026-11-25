import type { CoordinatesDTO } from '@documind/shared';
import type { ExtractedSegment } from '../extractors/extractor.types.js';

export const DEFAULT_CHUNK_SIZE = 600;
export const DEFAULT_CHUNK_OVERLAP = 100;

export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface TextChunk {
  chunkIndex: number;
  content: string;
  coordinates: CoordinatesDTO;
  tokenCount: number;
}

const SEPARATORS = ['\n\n', '\n', '. ', ' ', ''] as const;

function splitWithOverlap(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  separatorIdx: number
): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= chunkSize) return [trimmed];

  const separator = SEPARATORS[separatorIdx] ?? '';
  if (separator === '') {
    const slices: string[] = [];
    const step = chunkSize - chunkOverlap;
    for (let start = 0; start < trimmed.length; start += step) {
      const slice = trimmed.slice(start, start + chunkSize).trim();
      if (slice.length > 0) slices.push(slice);
      if (start + chunkSize >= trimmed.length) break;
    }
    return slices;
  }

  const rawParts = trimmed.split(separator);
  if (rawParts.length === 1) {
    return splitWithOverlap(trimmed, chunkSize, chunkOverlap, separatorIdx + 1);
  }

  // Re-attach sentence delimiter '.' when splitting on '. '
  const parts = rawParts
    .map((part, idx) =>
      separator === '. ' && idx < rawParts.length - 1 ? `${part}.` : part
    )
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let current = '';

  const joiner = separator === '. ' ? ' ' : separator;

  for (const part of parts) {
    if (part.length > chunkSize) {
      if (current.length > 0) {
        chunks.push(current);
        current = '';
      }
      const subChunks = splitWithOverlap(part, chunkSize, chunkOverlap, separatorIdx + 1);
      chunks.push(...subChunks);
      continue;
    }

    const candidate = current.length === 0 ? part : `${current}${joiner}${part}`;
    if (candidate.length <= chunkSize) {
      current = candidate;
    } else {
      if (current.length > 0) {
        chunks.push(current);
      }

      if (chunkOverlap > 0 && current.length > 0) {
        const overlapTail = current.slice(-chunkOverlap).trimStart();
        const withOverlap = overlapTail.length > 0 ? `${overlapTail}${joiner}${part}` : part;
        current = withOverlap.length <= chunkSize ? withOverlap : part;
      } else {
        current = part;
      }
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * Recursively chunks extracted document segments while preserving source coordinates.
 */
export function chunkDocumentContent(
  segments: ExtractedSegment[],
  options: ChunkOptions = {}
): TextChunk[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

  if (chunkSize <= 0) {
    throw new Error('chunkSize must be greater than 0');
  }
  if (chunkOverlap < 0 || chunkOverlap >= chunkSize) {
    throw new Error('chunkOverlap must be >= 0 and strictly less than chunkSize');
  }

  const results: TextChunk[] = [];
  let chunkIndex = 0;

  for (const segment of segments) {
    const pieces = splitWithOverlap(segment.content, chunkSize, chunkOverlap, 0);
    for (const content of pieces) {
      results.push({
        chunkIndex: chunkIndex++,
        content,
        coordinates: segment.coordinates,
        tokenCount: Math.max(1, Math.ceil(content.length / 4)),
      });
    }
  }

  return results;
}
