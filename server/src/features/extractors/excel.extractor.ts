import * as xlsx from 'xlsx';
import type { ExtractedSegment, ExtractionResult } from './extractor.types.js';

const ROWS_PER_SEGMENT = 20;

function formatCell(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  return String(cell).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function rowsToMarkdownTable(rows: unknown[][]): string {
  if (rows.length === 0) return '';
  const colCount = Math.max(...rows.map((r) => r.length));
  if (colCount === 0) return '';

  const formatRow = (row: unknown[]) =>
    `| ${Array.from({ length: colCount }, (_, i) => formatCell(row[i])).join(' | ')} |`;

  const lines = [formatRow(rows[0]), `| ${Array(colCount).fill('---').join(' | ')} |`];
  for (let i = 1; i < rows.length; i++) {
    lines.push(formatRow(rows[i]));
  }
  return lines.join('\n');
}

/**
 * Extracts worksheets from an XLSX buffer as Markdown tables with sheetName and row coordinates.
 */
export async function extractExcel(buffer: Buffer): Promise<ExtractionResult> {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const segments: ExtractedSegment[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows = xlsx.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
    });

    const nonEmptyRows = rawRows
      .map((row, idx) => ({ row, rowNumber: idx + 1 }))
      .filter(({ row }) => row.some((cell) => formatCell(cell).length > 0));

    if (nonEmptyRows.length === 0) continue;

    for (let i = 0; i < nonEmptyRows.length; i += ROWS_PER_SEGMENT) {
      const slice = nonEmptyRows.slice(i, i + ROWS_PER_SEGMENT);
      const mdTable = rowsToMarkdownTable(slice.map((entry) => entry.row));
      if (!mdTable) continue;

      segments.push({
        content: `### Sheet: ${sheetName}\n${mdTable}`,
        coordinates: {
          sheetName,
          rowStart: slice[0].rowNumber,
          rowEnd: slice[slice.length - 1].rowNumber,
        },
      });
    }
  }

  return {
    segments,
    isScanned: false,
    metadata: {
      sheetNames: workbook.SheetNames,
      sheetCount: workbook.SheetNames.length,
    },
  };
}
