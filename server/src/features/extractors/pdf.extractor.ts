import { PDFParse } from 'pdf-parse';
import type { ExtractedSegment, ExtractionResult } from './extractor.types.js';

const SCANNED_PDF_MIN_CHARS = 50;

/**
 * Extracts text page-by-page from a PDF buffer and detects scanned/image-only PDFs.
 */
export async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const textResult = await parser.getText();
    const totalCharacters = textResult.pages
      .map((page) => page.text.trim())
      .join('')
      .length;
    const isScanned = totalCharacters < SCANNED_PDF_MIN_CHARS;

    const segments: ExtractedSegment[] = isScanned
      ? []
      : textResult.pages
          .map((page) => ({
            content: page.text.trim(),
            coordinates: { pageNumber: page.num },
          }))
          .filter((seg) => seg.content.length > 0);

    return {
      segments,
      isScanned,
      pageCount: textResult.total,
      metadata: {
        isScanned,
        pageCount: textResult.total,
        totalCharacters,
      },
    };
  } finally {
    await parser.destroy();
  }
}
