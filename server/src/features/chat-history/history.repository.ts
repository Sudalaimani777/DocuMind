import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import type { ChatMessageDTO, ChatRole, ChatSessionDTO, CitationDTO } from '@documind/shared';
import { db } from '../../core/db/index.js';
import { chatMessages, chatSessions, documents } from '../../core/db/schema.js';
import { NotFoundError } from '../../core/errors/AppError.js';

export interface SessionPaginationInput {
  page: number;
  limit: number;
}

export interface CreateSessionInput {
  userId: string;
  documentId?: string | null;
  title: string;
}

export interface AppendExchangeInput {
  userId: string;
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
  citations: CitationDTO[];
}

export interface RecentHistoryItem {
  role: ChatRole;
  content: string;
}

export interface IChatHistoryRepository {
  listSessions(
    userId: string,
    pagination: SessionPaginationInput
  ): Promise<{ items: ChatSessionDTO[]; totalItems: number }>;
  findSessionByIdAndUser(sessionId: string, userId: string): Promise<ChatSessionDTO | null>;
  createSession(input: CreateSessionInput): Promise<ChatSessionDTO>;
  deleteSession(sessionId: string, userId: string): Promise<boolean>;
  listSessionMessages(sessionId: string, userId: string): Promise<ChatMessageDTO[]>;
  getRecentMessages(
    sessionId: string,
    userId: string,
    limit: number
  ): Promise<RecentHistoryItem[]>;
  appendExchange(input: AppendExchangeInput): Promise<{
    userMessage: ChatMessageDTO;
    assistantMessage: ChatMessageDTO;
  }>;
}

interface SessionAggregateRow {
  id: string;
  userId: string;
  documentId: string | null;
  documentTitle: string | null;
  title: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MessageRow {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  citations: CitationDTO[];
  createdAt: Date;
}

function mapSessionRow(row: SessionAggregateRow): ChatSessionDTO {
  return {
    id: row.id,
    userId: row.userId,
    documentId: row.documentId,
    documentTitle: row.documentTitle ?? null,
    title: row.title,
    messageCount: Number(row.messageCount ?? 0),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapMessageRow(row: MessageRow): ChatMessageDTO {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    content: row.content,
    citations: row.citations ?? [],
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Drizzle PostgreSQL repository for chat sessions and messages.
 * Every query enforces userId ownership filtering for tenant/user data isolation.
 */
export class DrizzleChatHistoryRepository implements IChatHistoryRepository {
  private buildSessionQuery(userId: string) {
    return db
      .select({
        id: chatSessions.id,
        userId: chatSessions.userId,
        documentId: chatSessions.documentId,
        documentTitle: documents.title,
        title: chatSessions.title,
        messageCount: sql<number>`count(${chatMessages.id})::int`,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
      })
      .from(chatSessions)
      .leftJoin(
        documents,
        and(eq(chatSessions.documentId, documents.id), eq(documents.userId, userId))
      )
      .leftJoin(chatMessages, eq(chatMessages.sessionId, chatSessions.id))
      .$dynamic();
  }

  async listSessions(
    userId: string,
    pagination: SessionPaginationInput
  ): Promise<{ items: ChatSessionDTO[]; totalItems: number }> {
    const offset = (pagination.page - 1) * pagination.limit;

    const [rows, countRows] = await Promise.all([
      this.buildSessionQuery(userId)
        .where(eq(chatSessions.userId, userId))
        .groupBy(chatSessions.id, documents.title)
        .orderBy(desc(chatSessions.updatedAt))
        .limit(pagination.limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(chatSessions)
        .where(eq(chatSessions.userId, userId)),
    ]);

    return {
      items: rows.map(mapSessionRow),
      totalItems: Number(countRows[0]?.total ?? 0),
    };
  }

  async findSessionByIdAndUser(sessionId: string, userId: string): Promise<ChatSessionDTO | null> {
    const [row] = await this.buildSessionQuery(userId)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .groupBy(chatSessions.id, documents.title)
      .limit(1);

    return row ? mapSessionRow(row) : null;
  }

  async createSession(input: CreateSessionInput): Promise<ChatSessionDTO> {
    let documentTitle: string | null = null;
    if (input.documentId) {
      const [doc] = await db
        .select({ id: documents.id, title: documents.title })
        .from(documents)
        .where(and(eq(documents.id, input.documentId), eq(documents.userId, input.userId)))
        .limit(1);

      if (!doc) {
        throw new NotFoundError('Document not found');
      }
      documentTitle = doc.title;
    }

    const [created] = await db
      .insert(chatSessions)
      .values({
        userId: input.userId,
        documentId: input.documentId ?? null,
        title: input.title.slice(0, 255),
      })
      .returning();

    return {
      id: created.id,
      userId: created.userId,
      documentId: created.documentId,
      documentTitle,
      title: created.title,
      messageCount: 0,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const deleted = await db
      .delete(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .returning({ id: chatSessions.id });

    return deleted.length > 0;
  }

  async listSessionMessages(sessionId: string, userId: string): Promise<ChatMessageDTO[]> {
    const rows = await db
      .select({
        id: chatMessages.id,
        sessionId: chatMessages.sessionId,
        role: chatMessages.role,
        content: chatMessages.content,
        citations: chatMessages.citations,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(and(eq(chatMessages.sessionId, sessionId), eq(chatSessions.userId, userId)))
      .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));

    return rows.map(mapMessageRow);
  }

  async getRecentMessages(
    sessionId: string,
    userId: string,
    limit: number
  ): Promise<RecentHistoryItem[]> {
    const rows = await db
      .select({
        role: chatMessages.role,
        content: chatMessages.content,
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(and(eq(chatMessages.sessionId, sessionId), eq(chatSessions.userId, userId)))
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(limit);

    return rows.reverse();
  }

  async appendExchange(input: AppendExchangeInput): Promise<{
    userMessage: ChatMessageDTO;
    assistantMessage: ChatMessageDTO;
  }> {
    return db.transaction(async (tx) => {
      const userTimestamp = new Date();
      const assistantTimestamp = new Date(userTimestamp.getTime() + 1);

      const [updatedSession] = await tx
        .update(chatSessions)
        .set({ updatedAt: assistantTimestamp })
        .where(and(eq(chatSessions.id, input.sessionId), eq(chatSessions.userId, input.userId)))
        .returning({ id: chatSessions.id });

      if (!updatedSession) {
        throw new NotFoundError('Chat session not found');
      }

      const [userRow] = await tx
        .insert(chatMessages)
        .values({
          sessionId: input.sessionId,
          role: 'user',
          content: input.userMessage,
          citations: [],
          createdAt: userTimestamp,
        })
        .returning();

      const [assistantRow] = await tx
        .insert(chatMessages)
        .values({
          sessionId: input.sessionId,
          role: 'assistant',
          content: input.assistantMessage,
          citations: input.citations,
          createdAt: assistantTimestamp,
        })
        .returning();

      return {
        userMessage: mapMessageRow(userRow),
        assistantMessage: mapMessageRow(assistantRow),
      };
    });
  }
}
