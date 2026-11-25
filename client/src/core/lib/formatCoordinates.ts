import type { CoordinatesDTO } from '@documind/shared';

/**
 * Formats structural document coordinates into human-readable citation labels.
 */
export function formatCoordinates(coords: CoordinatesDTO, chunkIndex = 0): string {
  const parts: string[] = [];

  if (coords.pageNumber !== undefined) {
    parts.push(`Page ${coords.pageNumber}`);
  }
  if (coords.sheetName) {
    if (coords.rowStart !== undefined && coords.rowEnd !== undefined) {
      parts.push(`Sheet: ${coords.sheetName} · Rows ${coords.rowStart}–${coords.rowEnd}`);
    } else {
      parts.push(`Sheet: ${coords.sheetName}`);
    }
  }
  if (coords.slideNumber !== undefined) {
    parts.push(`Slide ${coords.slideNumber}`);
  }

  if (parts.length === 0) {
    parts.push(`Chunk #${chunkIndex + 1}`);
  }

  return parts.join(' · ');
}
