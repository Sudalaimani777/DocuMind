import type { ChatMessageDTO, ChatSessionDTO, CitationDTO } from '@documind/shared';
import { NotFoundError } from '../../core/errors/AppError.js';
import type {
  IChatHistoryRepository,
  RecentHistoryItem,
  SessionPaginationInput,
} from './history.repository.js';
import { generateSessionTitle } from './title.generator.js';

const DEFAULT_RECENT_HISTORY_LIMIT = 6;
const MAX_TITLE_LENGTH = 255;

export interface PaginatedChatSessionsResult {
  items: ChatSessionDTO[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
}

export interface CreateChatSessionParams {
  query?: string;
  title?: string;
  documentId?: string | null;
}

export interface AppendChatExchangeParams {
  userMessage: string;
  assistantMessage: string;
  citations: CitationDTO[];
}

/**
 * Application service for managing user-scoped chat sessions and message history.
 */
export class ChatHistoryService {
  constructor(private readonly repository: IChatHistoryRepository) {}

  async listSessions(
    userId: string,
    pagination: SessionPaginationInput = { page: 1, limit: 20 }
  ): Promise<PaginatedChatSessionsResult> {
    const { items, totalItems } = await this.repository.listSessions(userId, pagination);
    const totalPages = Math.max(1, Math.ceil(totalItems / pagination.limit));

    return {
      items,
      pagination: {
        totalItems,
        totalPages,
        currentPage: pagination.page,
        limit: pagination.limit,
      },
    };
  }

  async getOwnedSession(userId: string, sessionId: string): Promise<ChatSessionDTO> {
    const session = await this.repository.findSessionByIdAndUser(sessionId, userId);
    if (!session) {
      throw new NotFoundError('Chat session not found');
    }
    return session;
  }

  async getSessionMessages(userId: string, sessionId: string): Promise<ChatMessageDTO[]> {
    await this.getOwnedSession(userId, sessionId);
    return this.repository.listSessionMessages(sessionId, userId);
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const deleted = await this.repository.deleteSession(sessionId, userId);
    if (!deleted) {
      throw new NotFoundError('Chat session not found');
    }
  }

  async createSession(
    userId: string,
    params: CreateChatSessionParams
  ): Promise<ChatSessionDTO> {
    const rawTitle =
      params.title && params.title.trim().length > 0
        ? params.title.trim()
        : generateSessionTitle(params.query ?? '');

    return this.repository.createSession({
      userId,
      documentId: params.documentId ?? null,
      title: rawTitle.slice(0, MAX_TITLE_LENGTH),
    });
  }

  async appendExchange(
    userId: string,
    sessionId: string,
    params: AppendChatExchangeParams
  ): Promise<{ userMessage: ChatMessageDTO; assistantMessage: ChatMessageDTO }> {
    await this.getOwnedSession(userId, sessionId);
    return this.repository.appendExchange({
      userId,
      sessionId,
      userMessage: params.userMessage,
      assistantMessage: params.assistantMessage,
      citations: params.citations,
    });
  }

  async getRecentHistory(
    userId: string,
    sessionId: string,
    limit: number = DEFAULT_RECENT_HISTORY_LIMIT
  ): Promise<RecentHistoryItem[]> {
    await this.getOwnedSession(userId, sessionId);
    if (limit <= 0) {
      return [];
    }
    const messages = await this.repository.getRecentMessages(sessionId, userId, limit);
    return messages.slice(-limit);
  }
}
