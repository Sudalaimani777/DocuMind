import type { DocumentFormat } from '@documind/shared';
import { BadRequestError } from '../../core/errors/AppError.js';
import type { ExtractionResult } from './extractor.types.js';
import { extractPdf } from './pdf.extractor.js';
import { extractDocx } from './docx.extractor.js';
import { extractExcel } from './excel.extractor.js';
import { extractPptx } from './pptx.extractor.js';

type FormatExtractor = (buffer: Buffer) => Promise<ExtractionResult>;

const EXTRACTOR_REGISTRY: Record<DocumentFormat, FormatExtractor> = {
  pdf: extractPdf,
  docx: extractDocx,
  xlsx: extractExcel,
  pptx: extractPptx,
};

/**
 * Dispatches binary document extraction to the format-specific parser.
 */
export async function extractDocumentContent(
  buffer: Buffer,
  format: DocumentFormat
): Promise<ExtractionResult> {
  const extractor = EXTRACTOR_REGISTRY[format];
  if (!extractor) {
    throw new BadRequestError(`Unsupported document format: ${String(format)}`);
  }
  return extractor(buffer);
}
