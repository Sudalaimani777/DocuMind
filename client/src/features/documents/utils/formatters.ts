import type { CoordinatesDTO } from '@documind/shared';

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatShortDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatCoordinates(coords: CoordinatesDTO): string {
  if (typeof coords.pageNumber === 'number') {
    return `Page ${coords.pageNumber}`;
  }
  if (coords.sheetName) {
    if (typeof coords.rowStart === 'number' && typeof coords.rowEnd === 'number') {
      return `Sheet: ${coords.sheetName} · Rows ${coords.rowStart}–${coords.rowEnd}`;
    }
    return `Sheet: ${coords.sheetName}`;
  }
  if (typeof coords.slideNumber === 'number') {
    return `Slide ${coords.slideNumber}`;
  }
  return 'Document Body';
}
