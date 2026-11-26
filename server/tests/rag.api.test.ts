import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { ChatMessageDTO, ChatSessionDTO, SearchResponseDTO } from '@documind/shared';
import { createApp } from '../src/app.js';
import { NotFoundError } from '../src/core/errors/AppError.js';
import { ACCESS_TOKEN_COOKIE, signAccessToken } from '../src/core/utils/jwt.js';
import type { LLMProvider } from '../src/features/ai/llm.provider.js';
import type { ChatHistoryService } from '../src/features/chat-history/history.service.js';
import type { IDocumentRepository } from '../src/features/documents/document.repository.js';
import { ContextOrchestrator } from '../src/features/rag/context.orchestrator.js';
import { RagController } from '../src/features/rag/rag.controller.js';
import type { SearchService } from '../src/features/search/search.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const DOC_ID = '33333333-3333-4333-8333-333333333333';
const ASSISTANT_MSG_ID = '44444444-4444-4444-8444-444444444444';

function authCookieFor(userId = USER_ID): string {
  const token = signAccessToken({
    id: userId,
    email: 'alice@example.com',
    name: 'Alice',
    organization: 'Acme Corp',
  });
  return `${ACCESS_TOKEN_COOKIE}=${token}`;
}

function parseSseEvents(raw: string): Array<{ event: string; data: unknown }> {
  const blocks = raw
    .split('\n\n')
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  return blocks.map((block) => {
    let event = 'message';
    let dataStr = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataStr += line.slice('data:'.length).trim();
      }
    }
    return {
      event,
      data: dataStr ? JSON.parse(dataStr) : null,
    };
  });
}

function createSampleSearchResponse(hasResults = true): SearchResponseDTO {
  return {
    query: 'What was Q3 revenue?',
    mode: 'hybrid',
    activeMode: 'hybrid',
    degraded: false,
    totalResults: hasResults ? 1 : 0,
    tookMs: 10,
    results: hasResults
      ? [
          {
            chunkId: '55555555-5555-4555-8555-555555555555',
            documentId: DOC_ID,
            documentTitle: 'Q3 Financial Report',
            originalFilename: 'q3.pdf',
            fileType: 'pdf',
            storageUrl: 'https://res.cloudinary.com/demo/raw/upload/q3.pdf',
            chunkIndex: 0,
            content: 'Quarterly revenue grew by 24% YoY to $42M.',
            snippet: 'Quarterly revenue grew by 24% YoY to $42M.',
            coordinates: { pageNumber: 4 },
            score: 0.92,
            lexicalScore: 0.88,
            semanticScore: 0.95,
            matchType: 'hybrid',
          },
        ]
      : [],
  };
}

function createSampleSession(overrides: Partial<ChatSessionDTO> = {}): ChatSessionDTO {
  return {
    id: SESSION_ID,
    userId: USER_ID,
    documentId: null,
    documentTitle: null,
    title: 'What was Q3 revenue?',
    messageCount: 0,
    createdAt: '2026-11-26T00:00:00.000Z',
    updatedAt: '2026-11-26T00:00:00.000Z',
    ...overrides,
  };
}

function createMockHistoryService(): ChatHistoryService {
  const assistantMsg: ChatMessageDTO = {
    id: ASSISTANT_MSG_ID,
    sessionId: SESSION_ID,
    role: 'assistant',
    content: 'Revenue grew 24% [1].',
    citations: [],
    createdAt: '2026-11-26T00:00:01.000Z',
  };

  return {
    listSessions: vi.fn().mockResolvedValue([]),
    getOwnedSession: vi.fn().mockResolvedValue(createSampleSession()),
    getSessionMessages: vi.fn().mockResolvedValue([]),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue(createSampleSession()),
    appendExchange: vi.fn().mockResolvedValue({
      userMessage: { ...assistantMsg, id: '66666666-6666-4666-8666-666666666666', role: 'user' },
      assistantMessage: assistantMsg,
    }),
    getRecentHistory: vi.fn().mockResolvedValue([]),
  } as unknown as ChatHistoryService;
}

describe('RAG API (POST /api/v1/chat/rag)', () => {
  it('returns 401 when unauthenticated', async () => {
    const mockOrchestrator = { execute: vi.fn() } as unknown as ContextOrchestrator;
    const app = createApp({ ragController: new RagController(mockOrchestrator) });

    const res = await request(app)
      .post('/api/v1/chat/rag')
      .send({ query: 'What was Q3 revenue?' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(mockOrchestrator.execute).not.toHaveBeenCalled();
  });

  it('returns 400 on empty query', async () => {
    const mockOrchestrator = { execute: vi.fn() } as unknown as ContextOrchestrator;
    const app = createApp({ ragController: new RagController(mockOrchestrator) });

    const res = await request(app)
      .post('/api/v1/chat/rag')
      .set('Cookie', authCookieFor())
      .send({ query: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockOrchestrator.execute).not.toHaveBeenCalled();
  });

  it('returns 404 when sessionId is not owned by user', async () => {
    const searchService = { search: vi.fn() } as unknown as SearchService;
    const historyService = createMockHistoryService();
    vi.mocked(historyService.getOwnedSession).mockRejectedValue(
      new NotFoundError('Chat session not found')
    );
    const documentRepo = { findByIdForUser: vi.fn() } as unknown as IDocumentRepository;
    const llmProvider: LLMProvider = {
      providerName: 'ollama',
      streamCompletion: vi.fn(),
    };

    const orchestrator = new ContextOrchestrator(
      searchService,
      historyService,
      documentRepo,
      () => llmProvider
    );
    const app = createApp({ ragController: new RagController(orchestrator) });

    const res = await request(app)
      .post('/api/v1/chat/rag')
      .set('Cookie', authCookieFor())
      .send({ query: 'Summarize Q3', sessionId: SESSION_ID });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(searchService.search).not.toHaveBeenCalled();
  });

  it('returns 404 when documentId is not owned by user', async () => {
    const searchService = { search: vi.fn() } as unknown as SearchService;
    const historyService = createMockHistoryService();
    const documentRepo = {
      findByIdForUser: vi.fn().mockResolvedValue(null),
    } as unknown as IDocumentRepository;
    const llmProvider: LLMProvider = {
      providerName: 'ollama',
      streamCompletion: vi.fn(),
    };

    const orchestrator = new ContextOrchestrator(
      searchService,
      historyService,
      documentRepo,
      () => llmProvider
    );
    const app = createApp({ ragController: new RagController(orchestrator) });

    const res = await request(app)
      .post('/api/v1/chat/rag')
      .set('Cookie', authCookieFor())
      .send({ query: 'Summarize Q3', documentId: DOC_ID });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(documentRepo.findByIdForUser).toHaveBeenCalledWith(DOC_ID, USER_ID);
    expect(searchService.search).not.toHaveBeenCalled();
  });

  it('streams token, citation, and done SSE events when chunks match', async () => {
    const searchService = {
      search: vi.fn().mockResolvedValue(createSampleSearchResponse(true)),
    } as unknown as SearchService;
    const historyService = createMockHistoryService();
    const documentRepo = {
      findByIdForUser: vi.fn().mockResolvedValue({ document: { id: DOC_ID }, chunks: [] }),
    } as unknown as IDocumentRepository;

    const llmProvider: LLMProvider = {
      providerName: 'ollama',
      streamCompletion: vi.fn(async (_prompt, onChunk) => {
        await onChunk('Revenue grew ');
        await onChunk('by 24% [1].');
        return 'Revenue grew by 24% [1].';
      }),
    };

    const orchestrator = new ContextOrchestrator(
      searchService,
      historyService,
      documentRepo,
      () => llmProvider
    );
    const app = createApp({ ragController: new RagController(orchestrator) });

    const res = await request(app)
      .post('/api/v1/chat/rag')
      .set('Cookie', authCookieFor())
      .send({ query: 'What was Q3 revenue?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const events = parseSseEvents(res.text);
    const tokenEvents = events.filter((e) => e.event === 'token');
    const citationEvents = events.filter((e) => e.event === 'citation');
    const doneEvents = events.filter((e) => e.event === 'done');

    expect(tokenEvents.map((e) => (e.data as { text: string }).text).join('')).toBe(
      'Revenue grew by 24% [1].'
    );
    expect(citationEvents).toHaveLength(1);
    expect(citationEvents[0].data).toMatchObject({
      index: 1,
      badge: '[1]',
      documentId: DOC_ID,
      documentTitle: 'Q3 Financial Report',
    });
    expect(doneEvents).toHaveLength(1);
    expect(doneEvents[0].data).toEqual({
      complete: true,
      sessionId: SESSION_ID,
      messageId: ASSISTANT_MSG_ID,
    });

    expect(searchService.search).toHaveBeenCalledWith(
      USER_ID,
      {
        q: 'What was Q3 revenue?',
        mode: 'hybrid',
        limit: 6,
        documentId: undefined,
      },
      { minSimilarity: 0.35 }
    );
    expect(historyService.appendExchange).toHaveBeenCalledWith(
      USER_ID,
      SESSION_ID,
      expect.objectContaining({
        userMessage: 'What was Q3 revenue?',
        assistantMessage: 'Revenue grew by 24% [1].',
        citations: expect.arrayContaining([
          expect.objectContaining({ index: 1, documentId: DOC_ID }),
        ]),
      })
    );
  });

  it('streams grounded fallback without calling LLMProvider when 0 chunks match', async () => {
    const searchService = {
      search: vi.fn().mockResolvedValue(createSampleSearchResponse(false)),
    } as unknown as SearchService;
    const historyService = createMockHistoryService();
    const documentRepo = { findByIdForUser: vi.fn() } as unknown as IDocumentRepository;
    const llmProvider: LLMProvider = {
      providerName: 'ollama',
      streamCompletion: vi.fn(),
    };

    const orchestrator = new ContextOrchestrator(
      searchService,
      historyService,
      documentRepo,
      () => llmProvider
    );
    const app = createApp({ ragController: new RagController(orchestrator) });

    const res = await request(app)
      .post('/api/v1/chat/rag')
      .set('Cookie', authCookieFor())
      .send({ query: 'What is the CEO favorite color?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const events = parseSseEvents(res.text);
    expect(events).toEqual([
      {
        event: 'token',
        data: {
          text: 'The provided documents do not contain information to answer this question.',
        },
      },
      {
        event: 'done',
        data: {
          complete: true,
          sessionId: SESSION_ID,
          messageId: ASSISTANT_MSG_ID,
        },
      },
    ]);
    expect(llmProvider.streamCompletion).not.toHaveBeenCalled();
    expect(historyService.appendExchange).toHaveBeenCalledWith(USER_ID, SESSION_ID, {
      userMessage: 'What is the CEO favorite color?',
      assistantMessage:
        'The provided documents do not contain information to answer this question.',
      citations: [],
    });
  });

  it('aborts LLM streaming cleanly when signal is aborted', async () => {
    const searchService = {
      search: vi.fn().mockResolvedValue(createSampleSearchResponse(true)),
    } as unknown as SearchService;
    const historyService = createMockHistoryService();
    const documentRepo = { findByIdForUser: vi.fn() } as unknown as IDocumentRepository;

    const abortController = new AbortController();
    let observedSignalAborted = false;

    const llmProvider: LLMProvider = {
      providerName: 'ollama',
      streamCompletion: vi.fn(async (_prompt, _onChunk, signal) => {
        abortController.abort();
        observedSignalAborted = Boolean(signal?.aborted);
        return 'partial';
      }),
    };

    const orchestrator = new ContextOrchestrator(
      searchService,
      historyService,
      documentRepo,
      () => llmProvider
    );

    const emitted: Array<{ event: string; data: unknown }> = [];
    await orchestrator.execute({
      userId: USER_ID,
      query: 'What was Q3 revenue?',
      signal: abortController.signal,
      emit: (event, data) => emitted.push({ event, data }),
    });

    expect(observedSignalAborted).toBe(true);
    expect(emitted.some((e) => e.event === 'done')).toBe(false);
    expect(historyService.appendExchange).not.toHaveBeenCalled();
  });

  it('uses relaxed minSimilarity=0.35 for global RAG and falls back to top-K nearest chunks (minSimilarity=0) when scoped document hybrid search returns 0', async () => {
    const searchMock = vi
      .fn()
      .mockResolvedValueOnce(createSampleSearchResponse(false))
      .mockResolvedValueOnce(createSampleSearchResponse(true));
    const searchService = {
      search: searchMock,
    } as unknown as SearchService;
    const historyService = createMockHistoryService();
    const documentRepo = {
      findByIdForUser: vi.fn().mockResolvedValue({ id: DOC_ID, userId: USER_ID }),
    } as unknown as IDocumentRepository;

    const llmProvider: LLMProvider = {
      providerName: 'ollama',
      streamCompletion: vi.fn(async (_prompt, onChunk) => {
        onChunk('Found in document [1].');
        return 'Found in document [1].';
      }),
    };

    const orchestrator = new ContextOrchestrator(
      searchService,
      historyService,
      documentRepo,
      () => llmProvider
    );

    const emitted: Array<{ event: string; data: unknown }> = [];
    await orchestrator.execute({
      userId: USER_ID,
      query: 'How many text colors are provided?',
      documentId: DOC_ID,
      emit: (event, data) => emitted.push({ event, data }),
    });

    expect(searchMock).toHaveBeenNthCalledWith(
      1,
      USER_ID,
      { q: 'How many text colors are provided?', mode: 'hybrid', limit: 6, documentId: DOC_ID },
      { minSimilarity: 0.25 }
    );
    expect(searchMock).toHaveBeenNthCalledWith(
      2,
      USER_ID,
      { q: 'How many text colors are provided?', mode: 'semantic', limit: 6, documentId: DOC_ID },
      { minSimilarity: 0 }
    );
    expect(llmProvider.streamCompletion).toHaveBeenCalledTimes(1);
    expect(emitted.some((e) => e.event === 'token')).toBe(true);
  });
});
