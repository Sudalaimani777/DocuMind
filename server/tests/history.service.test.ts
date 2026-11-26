import { describe, it, expect, beforeEach } from 'vitest';
import type { ChatMessageDTO, ChatSessionDTO, CitationDTO } from '@documind/shared';
import { AppError, NotFoundError } from '../src/core/errors/AppError.js';
import { generateSessionTitle } from '../src/features/chat-history/title.generator.js';
import type {
  AppendExchangeInput,
  CreateSessionInput,
  IChatHistoryRepository,
  RecentHistoryItem,
  SessionPaginationInput,
} from '../src/features/chat-history/history.repository.js';
import { ChatHistoryService } from '../src/features/chat-history/history.service.js';

interface StoredSession {
  id: string;
  userId: string;
  documentId: string | null;
  documentTitle: string | null;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: CitationDTO[];
  createdAt: Date;
}

class InMemoryChatHistoryRepository implements IChatHistoryRepository {
  private sessions = new Map<string, StoredSession>();
  private messages: StoredMessage[] = [];
  private docs = new Map<string, { userId: string; title: string }>();
  private seq = 0;

  seedDocument(documentId: string, title: string, userId = 'user-1'): void {
    this.docs.set(documentId, { userId, title });
  }

  seedMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    citations: CitationDTO[] = [],
    createdAt?: Date
  ): void {
    this.seq += 1;
    this.messages.push({
      id: `msg-${this.seq}`,
      sessionId,
      role,
      content,
      citations,
      createdAt: createdAt ?? new Date(Date.now() + this.seq * 1000),
    });
  }

  private toSessionDTO(session: StoredSession): ChatSessionDTO {
    const messageCount = this.messages.filter((m) => m.sessionId === session.id).length;
    return {
      id: session.id,
      userId: session.userId,
      documentId: session.documentId,
      documentTitle: session.documentTitle,
      title: session.title,
      messageCount,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  private toMessageDTO(message: StoredMessage): ChatMessageDTO {
    return {
      id: message.id,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      citations: message.citations,
      createdAt: message.createdAt.toISOString(),
    };
  }

  async listSessions(
    userId: string,
    pagination: SessionPaginationInput
  ): Promise<{ items: ChatSessionDTO[]; totalItems: number }> {
    const owned = Array.from(this.sessions.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const offset = (pagination.page - 1) * pagination.limit;
    const paged = owned.slice(offset, offset + pagination.limit);

    return {
      items: paged.map((s) => this.toSessionDTO(s)),
      totalItems: owned.length,
    };
  }

  async findSessionByIdAndUser(sessionId: string, userId: string): Promise<ChatSessionDTO | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }
    return this.toSessionDTO(session);
  }

  async createSession(input: CreateSessionInput): Promise<ChatSessionDTO> {
    let documentTitle: string | null = null;
    const documentId = input.documentId ?? null;

    if (documentId) {
      const doc = this.docs.get(documentId);
      if (!doc || doc.userId !== input.userId) {
        throw new NotFoundError('Document not found');
      }
      documentTitle = doc.title;
    }

    this.seq += 1;
    const now = new Date(1_700_000_000_000 + this.seq * 1000);
    const session: StoredSession = {
      id: `session-${this.seq}`,
      userId: input.userId,
      documentId,
      documentTitle,
      title: input.title.slice(0, 255),
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return this.toSessionDTO(session);
  }

  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return false;
    }
    this.sessions.delete(sessionId);
    this.messages = this.messages.filter((m) => m.sessionId !== sessionId);
    return true;
  }

  async listSessionMessages(sessionId: string, userId: string): Promise<ChatMessageDTO[]> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return [];
    }
    return this.messages
      .filter((m) => m.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((m) => this.toMessageDTO(m));
  }

  async getRecentMessages(
    sessionId: string,
    userId: string,
    limit: number
  ): Promise<RecentHistoryItem[]> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return [];
    }
    const sorted = this.messages
      .filter((m) => m.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return sorted.slice(-limit).map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  async appendExchange(input: AppendExchangeInput): Promise<{
    userMessage: ChatMessageDTO;
    assistantMessage: ChatMessageDTO;
  }> {
    const session = this.sessions.get(input.sessionId);
    if (!session || session.userId !== input.userId) {
      throw new NotFoundError('Chat session not found');
    }

    const baseTime = Date.now();
    this.seq += 1;
    const userMsg: StoredMessage = {
      id: `msg-${this.seq}`,
      sessionId: input.sessionId,
      role: 'user',
      content: input.userMessage,
      citations: [],
      createdAt: new Date(baseTime),
    };
    this.seq += 1;
    const assistantMsg: StoredMessage = {
      id: `msg-${this.seq}`,
      sessionId: input.sessionId,
      role: 'assistant',
      content: input.assistantMessage,
      citations: input.citations,
      createdAt: new Date(baseTime + 1),
    };

    this.messages.push(userMsg, assistantMsg);
    session.updatedAt = new Date(baseTime + 1);

    return {
      userMessage: this.toMessageDTO(userMsg),
      assistantMessage: this.toMessageDTO(assistantMsg),
    };
  }
}

function makeCitation(overrides: Partial<CitationDTO> = {}): CitationDTO {
  return {
    index: 1,
    badge: '[Q4 Report, Page 2]',
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    documentTitle: 'Q4 Report',
    fileType: 'pdf',
    similarity: 0.92,
    coordinates: { pageNumber: 2 },
    excerpt: 'Revenue grew 24% year-over-year.',
    ...overrides,
  };
}

describe('generateSessionTitle', () => {
  it('strips punctuation and extra whitespace and caps at 6 words', () => {
    const title = generateSessionTitle(
      '  What, exactly!!   are the   key   revenue   drivers in Q4 2025?  '
    );
    expect(title).toBe('What exactly are the key revenue');
  });

  it('returns "New Document Chat" when input is empty or punctuation-only', () => {
    expect(generateSessionTitle('')).toBe('New Document Chat');
    expect(generateSessionTitle('   \t\n  ')).toBe('New Document Chat');
    expect(generateSessionTitle('??? ... !!! --- ()')).toBe('New Document Chat');
  });

  it('truncates titles exceeding 255 characters', () => {
    const longWord = 'a'.repeat(300);
    const title = generateSessionTitle(longWord);
    expect(title).toHaveLength(255);
    expect(title).toBe('a'.repeat(255));
  });
});

describe('ChatHistoryService', () => {
  let repo: InMemoryChatHistoryRepository;
  let service: ChatHistoryService;

  beforeEach(() => {
    repo = new InMemoryChatHistoryRepository();
    service = new ChatHistoryService(repo);
  });

  it('throws 404 AppError when getSessionMessages or deleteSession targets missing or unowned session', async () => {
    const session = await service.createSession('user-1', {
      query: 'Summarize the Q4 financial report',
    });

    await expect(service.getSessionMessages('user-1', 'non-existent')).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(service.getSessionMessages('user-2', session.id)).rejects.toBeInstanceOf(AppError);
    await expect(service.getSessionMessages('user-2', session.id)).rejects.toMatchObject({
      statusCode: 404,
    });

    await expect(service.deleteSession('user-1', 'non-existent')).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(service.deleteSession('user-2', session.id)).rejects.toMatchObject({
      statusCode: 404,
    });

    await expect(service.deleteSession('user-1', session.id)).resolves.toBeUndefined();
    await expect(service.getSessionMessages('user-1', session.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('getRecentHistory returns at most the last 6 messages in chronological order and [] when limit <= 0', async () => {
    const session = await service.createSession('user-1', {
      query: 'Financial breakdown',
    });

    for (let i = 1; i <= 10; i++) {
      repo.seedMessage(
        session.id,
        i % 2 === 1 ? 'user' : 'assistant',
        `Message ${i}`,
        [],
        new Date(1_700_000_000_000 + i * 1000)
      );
    }

    const recent = await service.getRecentHistory('user-1', session.id);

    expect(recent).toHaveLength(6);
    expect(recent).toEqual([
      { role: 'user', content: 'Message 5' },
      { role: 'assistant', content: 'Message 6' },
      { role: 'user', content: 'Message 7' },
      { role: 'assistant', content: 'Message 8' },
      { role: 'user', content: 'Message 9' },
      { role: 'assistant', content: 'Message 10' },
    ]);

    await expect(service.getRecentHistory('user-1', session.id, 0)).resolves.toEqual([]);
    await expect(service.getRecentHistory('user-1', session.id, -3)).resolves.toEqual([]);
  });

  it('listSessions paginates results, maps ChatSessionDTO, and appendExchange persists citations', async () => {
    repo.seedDocument('doc-1', 'Q4 Financial Report', 'user-1');

    const s1 = await service.createSession('user-1', {
      query: 'What was Q4 revenue growth?',
      documentId: 'doc-1',
    });
    const s2 = await service.createSession('user-1', {
      query: 'Second session query',
    });
    const s3 = await service.createSession('user-1', {
      query: 'Third session query',
    });

    const citation = makeCitation();
    const { userMessage, assistantMessage } = await service.appendExchange('user-1', s1.id, {
      userMessage: 'What was Q4 revenue growth?',
      assistantMessage: 'Revenue grew 24% YoY [Q4 Report, Page 2].',
      citations: [citation],
    });

    expect(userMessage.role).toBe('user');
    expect(userMessage.citations).toEqual([]);
    expect(assistantMessage.role).toBe('assistant');
    expect(assistantMessage.citations).toEqual([citation]);

    const page1 = await service.listSessions('user-1', { page: 1, limit: 2 });
    expect(page1.pagination).toEqual({
      totalItems: 3,
      totalPages: 2,
      currentPage: 1,
      limit: 2,
    });
    expect(page1.items).toHaveLength(2);
    // s1 was updated most recently by appendExchange
    expect(page1.items[0]).toMatchObject({
      id: s1.id,
      userId: 'user-1',
      documentId: 'doc-1',
      documentTitle: 'Q4 Financial Report',
      title: 'What was Q4 revenue growth',
      messageCount: 2,
    });

    const page2 = await service.listSessions('user-1', { page: 2, limit: 2 });
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].id).toBe(s2.id);
    expect(page1.items[1].id).toBe(s3.id);

    const otherSessions = await service.listSessions('user-2', { page: 1, limit: 10 });
    expect(otherSessions.items).toHaveLength(0);
    expect(otherSessions.pagination.totalItems).toBe(0);
    expect(otherSessions.pagination.totalPages).toBe(1);

    const messages = await service.getSessionMessages('user-1', s1.id);
    expect(messages).toHaveLength(2);
    expect(messages[1].citations).toEqual([citation]);
  });

  it('createSession caps explicit title at 255 chars and rejects unowned or missing documentId with 404', async () => {
    repo.seedDocument('doc-owned-by-user-2', 'Secret Doc', 'user-2');

    const longTitle = 'X'.repeat(300);
    const created = await service.createSession('user-1', { title: longTitle });
    expect(created.title).toHaveLength(255);

    await expect(
      service.createSession('user-1', {
        query: 'Inspect secret doc',
        documentId: 'doc-owned-by-user-2',
      })
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      service.createSession('user-1', {
        query: 'Inspect missing doc',
        documentId: 'non-existent-doc',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
