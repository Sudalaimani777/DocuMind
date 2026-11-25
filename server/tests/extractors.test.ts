import { describe, it, expect } from 'vitest';
import * as xlsx from 'xlsx';
import JSZip from 'jszip';
import { extractDocumentContent } from '../src/features/extractors/extractors.service.js';
import { extractPdf } from '../src/features/extractors/pdf.extractor.js';
import { extractDocx } from '../src/features/extractors/docx.extractor.js';
import { extractExcel } from '../src/features/extractors/excel.extractor.js';
import { extractPptx } from '../src/features/extractors/pptx.extractor.js';

/**
 * Builds a minimal, valid multi-page PDF 1.4 binary buffer with exact byte xref offsets.
 */
function buildTestPdfBuffer(pagesText: string[]): Buffer {
  const objects: string[] = [];
  const pageObjNumbers: number[] = [];

  // Object 1: Catalog, Object 2: Pages, Object 3: Font (Helvetica)
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push(''); // placeholder for Pages object 2
  objects.push(
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  );

  let nextObjNum = 4;
  for (const text of pagesText) {
    const pageObjNum = nextObjNum++;
    const contentObjNum = nextObjNum++;
    pageObjNumbers.push(pageObjNum);

    const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const streamData = escaped.length > 0 ? `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET` : '';

    objects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj\n`
    );
    objects.push(
      `${contentObjNum} 0 obj\n<< /Length ${Buffer.byteLength(streamData, 'utf8')} >>\nstream\n${streamData}\nendstream\nendobj\n`
    );
  }

  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjNumbers.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjNumbers.length} >>\nendobj\n`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

/**
 * Builds a minimal valid DOCX OOXML ZIP archive with headings, paragraphs, and a table.
 */
async function buildTestDocxBuffer(): Promise<Buffer> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
</w:styles>`
  );

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Architecture Overview</w:t></w:r></w:p>
    <w:p><w:r><w:t>DocuMind extracts structured text from enterprise office documents.</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Metric</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Value</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>EBITDA</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>18.2%</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
  );

  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * Builds a minimal valid XLSX workbook buffer with two worksheets.
 */
function buildTestXlsxBuffer(): Buffer {
  const wb = xlsx.utils.book_new();
  const summarySheet = xlsx.utils.aoa_to_sheet([
    ['Quarter', 'Revenue', 'Margin'],
    ['Q1', 100, '15%'],
    ['Q2', 120, '18%'],
  ]);
  const notesSheet = xlsx.utils.aoa_to_sheet([
    ['Item', 'Status'],
    ['Audit', 'Completed'],
  ]);
  xlsx.utils.book_append_sheet(wb, summarySheet, 'Summary');
  xlsx.utils.book_append_sheet(wb, notesSheet, 'Notes');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * Builds a minimal valid PPTX OOXML ZIP archive with 2 slides and speaker notes on slide 1.
 */
async function buildTestPptxBuffer(): Promise<Buffer> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
    <p:sldId id="257" r:id="rId2"/>
  </p:sldIdLst>
</p:presentation>`
  );

  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Q3 Financial Highlights</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`
  );

  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/notesSlides/notesSlide1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Presenter Note: Highlight 240bps EBITDA expansion.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:notes>`
  );

  zip.file(
    'ppt/slides/slide2.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Next Quarter Roadmap</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`
  );

  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('Milestone 1.6: Multi-Format Content Extractors', () => {
  describe('PDF Extractor', () => {
    it('extracts text page-by-page with pageNumber coordinates', async () => {
      const pdfBuf = buildTestPdfBuffer([
        'Page one contains detailed revenue analysis for the third fiscal quarter.',
        'Page two summarizes operating expenses and net cash flow projections.',
      ]);

      const result = await extractPdf(pdfBuf);

      expect(result.isScanned).toBe(false);
      expect(result.pageCount).toBe(2);
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].content).toContain('Page one contains detailed revenue analysis');
      expect(result.segments[0].coordinates).toEqual({ pageNumber: 1 });
      expect(result.segments[1].content).toContain('Page two summarizes operating expenses');
      expect(result.segments[1].coordinates).toEqual({ pageNumber: 2 });
    });

    it('flags PDFs with fewer than 50 extracted characters as isScanned: true', async () => {
      const scannedBuf = buildTestPdfBuffer(['']);

      const result = await extractPdf(scannedBuf);

      expect(result.isScanned).toBe(true);
      expect(result.metadata.isScanned).toBe(true);
      expect(result.segments).toEqual([]);
    });
  });

  describe('Word DOCX Extractor', () => {
    it('extracts headings, paragraphs, and formats tables into Markdown syntax', async () => {
      const docxBuf = await buildTestDocxBuffer();

      const result = await extractDocx(docxBuf);

      expect(result.isScanned).toBe(false);
      expect(result.segments.length).toBeGreaterThanOrEqual(1);
      const fullText = result.segments.map((s) => s.content).join('\n\n');
      expect(fullText).toContain('# Architecture Overview');
      expect(fullText).toContain('DocuMind extracts structured text');
      expect(fullText).toContain('| Metric | Value |');
      expect(fullText).toContain('| --- | --- |');
      expect(fullText).toContain('| EBITDA | 18.2% |');
    });
  });

  describe('Excel XLSX Extractor', () => {
    it('iterates worksheets, formats rows as Markdown tables, and preserves sheetName + row coordinates', async () => {
      const xlsxBuf = buildTestXlsxBuffer();

      const result = await extractExcel(xlsxBuf);

      expect(result.isScanned).toBe(false);
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].coordinates).toEqual({
        sheetName: 'Summary',
        rowStart: 1,
        rowEnd: 3,
      });
      expect(result.segments[0].content).toContain('| Quarter | Revenue | Margin |');
      expect(result.segments[0].content).toContain('| Q1 | 100 | 15% |');
      expect(result.segments[1].coordinates).toEqual({
        sheetName: 'Notes',
        rowStart: 1,
        rowEnd: 2,
      });
      expect(result.segments[1].content).toContain('| Audit | Completed |');
    });
  });

  describe('PowerPoint PPTX Extractor', () => {
    it('extracts slide body text and speaker notes with slideNumber coordinates', async () => {
      const pptxBuf = await buildTestPptxBuffer();

      const result = await extractPptx(pptxBuf);

      expect(result.isScanned).toBe(false);
      expect(result.segments.length).toBeGreaterThanOrEqual(2);
      expect(result.segments[0].coordinates).toEqual({ slideNumber: 1 });
      expect(result.segments[0].content).toContain('Q3 Financial Highlights');
      expect(result.segments[0].content).toContain('Highlight 240bps EBITDA expansion');
      expect(result.segments[1].coordinates).toEqual({ slideNumber: 2 });
      expect(result.segments[1].content).toContain('Next Quarter Roadmap');
    });
  });

  describe('Unified Extractor Dispatcher', () => {
    it('routes supported formats and rejects unsupported formats', async () => {
      const xlsxBuf = buildTestXlsxBuffer();
      const res = await extractDocumentContent(xlsxBuf, 'xlsx');
      expect(res.segments.length).toBeGreaterThan(0);

      await expect(
        extractDocumentContent(Buffer.from('text'), 'txt' as unknown as 'pdf')
      ).rejects.toThrow(/Unsupported document format/);
    });
  });
});
