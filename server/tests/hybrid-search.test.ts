import { describe, it, expect, vi } from 'vitest';
import type { SearchResultItemDTO } from '@documind/shared';
import { mergeWithRrf } from '../src/features/search/rrf.js';
import { HybridSearchService } from '../src/features/search/hybrid.service.js';
import { SearchService } from '../src/features/search/search.service.js';
import type { LexicalSearchService } from '../src/features/search/lexical.service.js';
import type { SemanticSearchService } from '../src/features/search/semantic.service.js';
import { AppError } from '../src/core/errors/AppError.js';

function makeItem(
  chunkId: string,
  matchType: 'lexical' | 'semantic',
  score: number,
  snippet: string
): SearchResultItemDTO {
  return {
    chunkId,
    documentId: `doc-${chunkId}`,
    documentTitle: `Doc ${chunkId}`,
    originalFilename: `doc-${chunkId}.pdf`,
    fileType: 'pdf',
    storageUrl: `https://example.com/${chunkId}.pdf`,
    chunkIndex: 0,
    content: `Full content for ${chunkId}`,
    snippet,
    coordinates: { pageNumber: 1 },
    score,
    ...(matchType === 'lexical' ? { lexicalScore: score } : { semanticScore: score }),
    matchType,
  };
}

describe('mergeWithRrf', () => {
  it('merges lexical and semantic lists with k=60, deduplicates chunks, and prefers <mark> snippets', () => {
    const lexical = [
      makeItem('chunk-shared', 'lexical', 0.85, 'Exact <mark>revenue</mark> match'),
      makeItem('chunk-lex-only', 'lexical', 0.72, 'Another <mark>revenue</mark> hit'),
    ];
    const semantic = [
      makeItem('chunk-sem-only', 'semantic', 0.94, 'Plain semantic excerpt'),
      makeItem('chunk-shared', 'semantic', 0.88, 'Plain shared semantic excerpt'),
    ];

    const merged = mergeWithRrf(lexical, semantic, 10, 60);

    expect(merged).toHaveLength(3);
    expect(merged[0].chunkId).toBe('chunk-shared');
    expect(merged[0].matchType).toBe('hybrid');
    expect(merged[0].snippet).toBe('Exact <mark>revenue</mark> match');
    expect(merged[0].lexicalScore).toBe(0.85);
    expect(merged[0].semanticScore).toBe(0.88);
    expect(merged[0].score).toBeCloseTo(1 / 61 + 1 / 62, 6);
  });

  it('enforces the requested result limit', () => {
    const lexical = [
      makeItem('c1', 'lexical', 0.9, '<mark>a</mark>'),
      makeItem('c2', 'lexical', 0.8, '<mark>b</mark>'),
    ];
    const semantic = [makeItem('c3', 'semantic', 0.95, 'c')];

    const merged = mergeWithRrf(lexical, semantic, 2, 60);
    expect(merged).toHaveLength(2);
  });
});

describe('HybridSearchService & SearchService', () => {
  it('degrades gracefully to keyword results when semantic search fails in hybrid mode', async () => {
    const lexItem = makeItem('c1', 'lexical', 0.8, '<mark>clause</mark>');
    const lexicalService = {
      search: vi.fn().mockResolvedValue([lexItem]),
    } as unknown as LexicalSearchService;
    const semanticService = {
      search: vi.fn().mockRejectedValue(new Error('Ollama offline')),
    } as unknown as SemanticSearchService;

    const hybridService = new HybridSearchService(lexicalService, semanticService);
    const searchService = new SearchService(lexicalService, semanticService, hybridService);

    const response = await searchService.search('user-1', {
      q: 'clause',
      mode: 'hybrid',
      limit: 10,
    });

    expect(response.mode).toBe('hybrid');
    expect(response.activeMode).toBe('keyword');
    expect(response.degraded).toBe(true);
    expect(response.totalResults).toBe(1);
    expect(response.results[0].chunkId).toBe('c1');
    expect(response.tookMs).toBeGreaterThanOrEqual(0);
  });

  it('throws 503 AI_PROVIDER_UNAVAILABLE when semantic search fails in semantic mode', async () => {
    const lexicalService = {
      search: vi.fn(),
    } as unknown as LexicalSearchService;
    const semanticService = {
      search: vi.fn().mockRejectedValue(new Error('Gemini rate limit')),
    } as unknown as SemanticSearchService;

    const hybridService = new HybridSearchService(lexicalService, semanticService);
    const searchService = new SearchService(lexicalService, semanticService, hybridService);

    await expect(
      searchService.search('user-1', { q: 'clause', mode: 'semantic', limit: 10 })
    ).rejects.toMatchObject<Partial<AppError>>({
      statusCode: 503,
      errorCode: 'AI_PROVIDER_UNAVAILABLE',
    });
  });

  it('deduplicates multiple chunks from the same document in repository-wide search, but keeps all when documentId is scoped', async () => {
    const chunkA = { ...makeItem('c1', 'lexical', 0.9, '<mark>air</mark> p1'), documentId: 'doc-same' };
    const chunkB = { ...makeItem('c2', 'lexical', 0.7, '<mark>air</mark> p2'), documentId: 'doc-same' };
    const lexicalService = {
      search: vi.fn().mockResolvedValue([chunkA, chunkB]),
    } as unknown as LexicalSearchService;
    const semanticService = {
      search: vi.fn().mockResolvedValue([]),
    } as unknown as SemanticSearchService;

    const hybridService = new HybridSearchService(lexicalService, semanticService);
    const searchService = new SearchService(lexicalService, semanticService, hybridService);

    const repoWide = await searchService.search('user-1', { q: 'air', mode: 'keyword', limit: 10 });
    expect(repoWide.totalResults).toBe(1);
    expect(repoWide.results[0].chunkId).toBe('c1');

    const scoped = await searchService.search('user-1', {
      q: 'air',
      mode: 'keyword',
      documentId: 'doc-same',
      limit: 10,
    });
    expect(scoped.totalResults).toBe(2);
  });
});
