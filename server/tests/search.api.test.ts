import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { SearchResponseDTO } from '@documind/shared';
import { createApp } from '../src/app.js';
import { ACCESS_TOKEN_COOKIE, signAccessToken } from '../src/core/utils/jwt.js';
import { AppError } from '../src/core/errors/AppError.js';
import type { SearchService } from '../src/features/search/search.service.js';

function authCookieFor(userId = 'user-1'): string {
  const token = signAccessToken({
    id: userId,
    email: 'alice@example.com',
    name: 'Alice',
    organization: 'Acme Corp',
  });
  return `${ACCESS_TOKEN_COOKIE}=${token}`;
}

function createSampleResponse(overrides: Partial<SearchResponseDTO> = {}): SearchResponseDTO {
  return {
    query: 'revenue',
    mode: 'hybrid',
    activeMode: 'hybrid',
    degraded: false,
    totalResults: 1,
    tookMs: 12,
    results: [
      {
        chunkId: 'chunk-1',
        documentId: '11111111-1111-4111-8111-111111111111',
        documentTitle: 'Q3 Financial Report',
        originalFilename: 'q3.pdf',
        fileType: 'pdf',
        storageUrl: 'https://res.cloudinary.com/demo/raw/upload/q3.pdf',
        chunkIndex: 2,
        content: 'Quarterly revenue grew by 24% YoY.',
        snippet: 'Quarterly <mark>revenue</mark> grew by 24% YoY.',
        coordinates: { pageNumber: 14 },
        score: 0.032,
        lexicalScore: 0.85,
        semanticScore: 0.91,
        matchType: 'hybrid',
      },
    ],
    ...overrides,
  };
}

describe('Search API (/api/v1/search)', () => {
  it('returns 401 when unauthenticated', async () => {
    const mockSearchService = { search: vi.fn() } as unknown as SearchService;
    const app = createApp({ searchService: mockSearchService });

    const res = await request(app).get('/api/v1/search?q=revenue');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(mockSearchService.search).not.toHaveBeenCalled();
  });

  it('returns 400 for blank query or invalid date range', async () => {
    const mockSearchService = { search: vi.fn() } as unknown as SearchService;
    const app = createApp({ searchService: mockSearchService });

    const emptyRes = await request(app)
      .get('/api/v1/search?q=   ')
      .set('Cookie', authCookieFor());
    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body.error.code).toBe('VALIDATION_ERROR');

    const dateRes = await request(app)
      .get('/api/v1/search?q=revenue&startDate=2026-11-25&endDate=2026-11-01')
      .set('Cookie', authCookieFor());
    expect(dateRes.status).toBe(400);
    expect(dateRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('executes GET /api/v1/search with validated query params and userId', async () => {
    const sample = createSampleResponse();
    const mockSearchService = {
      search: vi.fn().mockResolvedValue(sample),
    } as unknown as SearchService;
    const app = createApp({ searchService: mockSearchService });

    const res = await request(app)
      .get('/api/v1/search?q=revenue&mode=hybrid&format=pdf&limit=5')
      .set('Cookie', authCookieFor('user-42'));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(sample);
    expect(mockSearchService.search).toHaveBeenCalledWith(
      'user-42',
      expect.objectContaining({
        q: 'revenue',
        mode: 'hybrid',
        format: 'pdf',
        limit: 5,
      })
    );
  });

  it('executes POST /api/v1/search with JSON body', async () => {
    const sample = createSampleResponse({ query: 'operating income', mode: 'semantic', activeMode: 'semantic' });
    const mockSearchService = {
      search: vi.fn().mockResolvedValue(sample),
    } as unknown as SearchService;
    const app = createApp({ searchService: mockSearchService });

    const res = await request(app)
      .post('/api/v1/search')
      .set('Cookie', authCookieFor('user-99'))
      .send({ q: 'operating income', mode: 'semantic', limit: 8 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activeMode).toBe('semantic');
    expect(mockSearchService.search).toHaveBeenCalledWith(
      'user-99',
      expect.objectContaining({
        q: 'operating income',
        mode: 'semantic',
        limit: 8,
      })
    );
  });

  it('propagates 503 AI_PROVIDER_UNAVAILABLE from semantic mode', async () => {
    const mockSearchService = {
      search: vi
        .fn()
        .mockRejectedValue(
          new AppError('Semantic search is currently unavailable', 503, 'AI_PROVIDER_UNAVAILABLE')
        ),
    } as unknown as SearchService;
    const app = createApp({ searchService: mockSearchService });

    const res = await request(app)
      .get('/api/v1/search?q=revenue&mode=semantic')
      .set('Cookie', authCookieFor());

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AI_PROVIDER_UNAVAILABLE');
  });
});
