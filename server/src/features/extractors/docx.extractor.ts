import mammoth from 'mammoth';
import type { ExtractedSegment, ExtractionResult } from './extractor.types.js';

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlTableToMarkdown(tableHtml: string): string {
  const rowMatches = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rows: string[][] = [];

  for (const rowMatch of rowMatches) {
    const cellMatches = [...rowMatch[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)];
    const cells = cellMatches.map((cell) => stripTags(cell[1]).replace(/\|/g, '\\|'));
    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) {
    return '';
  }

  const colCount = Math.max(...rows.map((r) => r.length));
  const normalizeRow = (r: string[]) =>
    `| ${Array.from({ length: colCount }, (_, idx) => r[idx] ?? '').join(' | ')} |`;

  const lines = [normalizeRow(rows[0]), `| ${Array(colCount).fill('---').join(' | ')} |`];
  for (let i = 1; i < rows.length; i++) {
    lines.push(normalizeRow(rows[i]));
  }
  return lines.join('\n');
}

function htmlToMarkdownBlocks(html: string): string[] {
  const blocks: string[] = [];
  const blockPattern = /<(h[1-6]|p|li|table)\b[^>]*>([\s\S]*?)<\/\1>/gi;

  for (const match of html.matchAll(blockPattern)) {
    const tag = match[1].toLowerCase();
    const inner = match[2];

    if (tag.startsWith('h')) {
      const level = Number(tag.slice(1));
      const text = stripTags(inner);
      if (text) blocks.push(`${'#'.repeat(level)} ${text}`);
    } else if (tag === 'table') {
      const mdTable = htmlTableToMarkdown(inner);
      if (mdTable) blocks.push(mdTable);
    } else if (tag === 'li') {
      const text = stripTags(inner);
      if (text) blocks.push(`- ${text}`);
    } else {
      const text = stripTags(inner);
      if (text) blocks.push(text);
    }
  }

  return blocks;
}

/**
 * Extracts headings, paragraphs, lists, and Markdown tables from a DOCX buffer.
 */
export async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const htmlResult = await mammoth.convertToHtml({ buffer });
  let blocks = htmlToMarkdownBlocks(htmlResult.value);

  if (blocks.length === 0) {
    const rawResult = await mammoth.extractRawText({ buffer });
    blocks = rawResult.value
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  const BLOCKS_PER_SEGMENT = 6;
  const segments: ExtractedSegment[] = [];

  for (let i = 0; i < blocks.length; i += BLOCKS_PER_SEGMENT) {
    const content = blocks.slice(i, i + BLOCKS_PER_SEGMENT).join('\n\n');
    if (content.trim().length > 0) {
      segments.push({
        content,
        coordinates: { pageNumber: Math.floor(i / BLOCKS_PER_SEGMENT) + 1 },
      });
    }
  }

  return {
    segments,
    isScanned: false,
    metadata: {
      blockCount: blocks.length,
      warnings: htmlResult.messages.length,
    },
  };
}
