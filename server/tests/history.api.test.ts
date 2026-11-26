import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { ChatMessageDTO, ChatSessionDTO } from '@documind/shared';
import { createApp } from '../src/app.js';
import { NotFoundError } from '../src/core/errors/AppError.js';
import { ACCESS_TOKEN_COOKIE, signAccessToken } from '../src/core/utils/jwt.js';
import type { ChatHistoryService } from '../src/features/chat-history/history.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

function authCookieFor(userId = USER_ID): string {
  const token = signAccessToken({
    id: userId,
    email: 'alice@example.com',
    name: 'Alice',
    organization: 'Acme Corp',
  });
  return `${ACCESS_TOKEN_COOKIE}=${token}`;
}

function makeSession(index: number): ChatSessionDTO {
  return {
    id: `22222222-2222-4222-8222-22222222220${index}`,
    userId: USER_ID,
    documentId: null,
    documentTitle: null,
    title: `Session ${index}`,
    messageCount: 2,
    createdAt: `2026-11-26T00:0${index}:00.000Z`,
    updatedAt: `2026-11-26T00:0${index}:00.000Z`,
  };
}

describe('Chat History API (/api/v1/chat/sessions)', () => {
  it('returns 401 when unauthenticated across all history endpoints', async () => {
    const mockHistoryService = {
      listSessions: vi.fn(),
      getSessionMessages: vi.fn(),
      deleteSession: vi.fn(),
    } as unknown as ChatHistoryService;
    const app = createApp({ historyService: mockHistoryService });

    const listRes = await request(app).get('/api/v1/chat/sessions');
    const msgRes = await request(app).get(`/api/v1/chat/sessions/${SESSION_ID}/messages`);
    const delRes = await request(app).delete(`/api/v1/chat/sessions/${SESSION_ID}`);

    expect(listRes.status).toBe(401);
    expect(msgRes.status).toBe(401);
    expect(delRes.status).toBe(401);
    expect(mockHistoryService.listSessions).not.toHaveBeenCalled();
    expect(mockHistoryService.getSessionMessages).not.toHaveBeenCalled();
    expect(mockHistoryService.deleteSession).not.toHaveBeenCalled();
  });

  it('paginates GET /api/v1/chat/sessions for the authenticated user', async () => {
    const paginated = {
      items: [makeSession(3), makeSession(4)],
      pagination: {
        totalItems: 5,
        totalPages: 3,
        currentPage: 2,
        limit: 2,
      },
    };
    const mockHistoryService = {
      listSessions: vi.fn().mockResolvedValue(paginated),
    } as unknown as ChatHistoryService;
    const app = createApp({ historyService: mockHistoryService });

    const res = await request(app)
      .get('/api/v1/chat/sessions?page=2&limit=2')
      .set('Cookie', authCookieFor(USER_ID));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      sessions: paginated.items,
      pagination: paginated.pagination,
    });
    expect(mockHistoryService.listSessions).toHaveBeenCalledWith(USER_ID, { page: 2, limit: 2 });
  });

  it('returns chronological messages for GET /api/v1/chat/sessions/:id/messages', async () => {
    const messages: ChatMessageDTO[] = [
      {
        id: '33333333-3333-4333-8333-333333333331',
        sessionId: SESSION_ID,
        role: 'user',
        content: 'What is the revenue?',
        citations: [],
        createdAt: '2026-11-26T00:00:00.000Z',
      },
      {
        id: '33333333-3333-4333-8333-333333333332',
        sessionId: SESSION_ID,
        role: 'assistant',
        content: 'Revenue grew 24% [1].',
        citations: [],
        createdAt: '2026-11-26T00:00:01.000Z',
      },
    ];
    const mockHistoryService = {
      getSessionMessages: vi.fn().mockResolvedValue(messages),
    } as unknown as ChatHistoryService;
    const app = createApp({ historyService: mockHistoryService });

    const res = await request(app)
      .get(`/api/v1/chat/sessions/${SESSION_ID}/messages`)
      .set('Cookie', authCookieFor(USER_ID));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toEqual(messages);
    expect(mockHistoryService.getSessionMessages).toHaveBeenCalledWith(USER_ID, SESSION_ID);
  });

  it('returns 404 when accessing another user session messages', async () => {
    const mockHistoryService = {
      getSessionMessages: vi.fn().mockRejectedValue(new NotFoundError('Chat session not found')),
    } as unknown as ChatHistoryService;
    const app = createApp({ historyService: mockHistoryService });

    const res = await request(app)
      .get(`/api/v1/chat/sessions/${SESSION_ID}/messages`)
      .set('Cookie', authCookieFor(USER_ID));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('deletes an owned session via DELETE /api/v1/chat/sessions/:id and returns 404 for cross-user', async () => {
    const mockHistoryService = {
      deleteSession: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new NotFoundError('Chat session not found')),
    } as unknown as ChatHistoryService;
    const app = createApp({ historyService: mockHistoryService });

    const okRes = await request(app)
      .delete(`/api/v1/chat/sessions/${SESSION_ID}`)
      .set('Cookie', authCookieFor(USER_ID));

    expect(okRes.status).toBe(200);
    expect(okRes.body.success).toBe(true);
    expect(okRes.body.data).toEqual({ deletedId: SESSION_ID });
    expect(mockHistoryService.deleteSession).toHaveBeenCalledWith(USER_ID, SESSION_ID);

    const notFoundRes = await request(app)
      .delete(`/api/v1/chat/sessions/${SESSION_ID}`)
      .set('Cookie', authCookieFor('99999999-9999-4999-8999-999999999999'));

    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.success).toBe(false);
    expect(notFoundRes.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 on invalid session UUID parameter', async () => {
    const mockHistoryService = {
      getSessionMessages: vi.fn(),
      deleteSession: vi.fn(),
    } as unknown as ChatHistoryService;
    const app = createApp({ historyService: mockHistoryService });

    const res = await request(app)
      .get('/api/v1/chat/sessions/not-a-uuid/messages')
      .set('Cookie', authCookieFor(USER_ID));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
