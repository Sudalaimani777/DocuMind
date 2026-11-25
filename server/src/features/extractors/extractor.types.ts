import type { CoordinatesDTO } from '@documind/shared';

export interface ExtractedSegment {
  content: string;
  coordinates: CoordinatesDTO;
}

export interface ExtractionResult {
  segments: ExtractedSegment[];
  isScanned: boolean;
  pageCount?: number;
  metadata: Record<string, unknown>;
}
