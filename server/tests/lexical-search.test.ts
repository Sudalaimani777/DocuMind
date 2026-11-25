import { describe, it, expect, vi } from 'vitest';
import { sanitizeSnippet, buildFallbackExcerpt } from '../src/features/search/snippet.service.js';
import { buildSearchConditions } from '../src/features/search/filter.builder.js';
import { LexicalSearchService } from '../src/features/search/lexical.service.js';
import type { ISearchRepository, RawSearchRow } from '../src/features/search/search.repository.js';

describe('snippet.service', () => {
  it('preserves <mark> tags and strips XSS payloads and attributes', () => {
    const dirty =
      'Revenue <mark onclick="alert(1)">grew</mark> <img src=x onerror=alert(1)><script>evil()</script> fast';
    expect(sanitizeSnippet(dirty)).toBe('Revenue <mark>grew</mark>  fast');
  });

  it('builds a clean plain-text fallback excerpt truncated with ellipsis', () => {
    const text = 'revenue '.repeat(40);
    const excerpt = buildFallbackExcerpt(text, 80);
    expect(excerpt.length).toBeLessThanOrEqual(83);
    expect(excerpt.endsWith('...')).toBe(true);
  });

  it('returns normalized full text without ellipsis when within maxLength', () => {
    expect(buildFallbackExcerpt('Short\n\n  paragraph   text.', 100)).toBe('Short paragraph text.');
  });
});

describe('filter.builder', () => {
  it('always includes userId and completed status conditions', () => {
    const base = buildSearchConditions('user-1', {});
    expect(base).toHaveLength(2);
  });

  it('appends format, date range, and documentId conditions when provided', () => {
    const full = buildSearchConditions('user-1', {
      format: 'pdf',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.999Z'),
      documentId: '11111111-1111-4111-8111-111111111111',
    });
    expect(full).toHaveLength(6);
  });
});

describe('LexicalSearchService', () => {
  it('executes lexical search, sanitizes ts_headline snippets, and attaches coordinates', async () => {
    const mockRow: RawSearchRow = {
      chunkId: 'chunk-1',
      documentId: 'doc-1',
      documentTitle: 'Q3 Financial Report',
      originalFilename: 'q3_report.pdf',
      fileType: 'pdf',
      storageUrl: 'https://res.cloudinary.com/demo/raw/upload/q3.pdf',
      chunkIndex: 4,
      content: 'Operating revenue increased by 24% year over year.',
      snippetHtml: 'Operating <mark>revenue</mark> <script>alert(1)</script> increased by 24%.',
      coordinates: { pageNumber: 14 },
      score: 0.87,
    };

    const repo: ISearchRepository = {
      searchLexical: vi.fn().mockResolvedValue([mockRow]),
      searchSemantic: vi.fn().mockResolvedValue([]),
    };

    const service = new LexicalSearchService(repo);
    const results = await service.search('user-1', 'revenue & growth', { format: 'pdf' }, 10);

    expect(repo.searchLexical).toHaveBeenCalledWith(
      'user-1',
      'revenue & growth',
      { format: 'pdf' },
      10
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      chunkId: 'chunk-1',
      documentTitle: 'Q3 Financial Report',
      fileType: 'pdf',
      coordinates: { pageNumber: 14 },
      snippet: 'Operating <mark>revenue</mark>  increased by 24%.',
      score: 0.87,
      lexicalScore: 0.87,
      matchType: 'lexical',
    });
  });
});
