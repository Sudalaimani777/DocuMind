import { and, asc, count, desc, eq } from 'drizzle-orm';
import type { DocumentChunkDTO, DocumentDTO, DocumentFormat } from '@documind/shared';
import { db } from '../../core/db/index.js';
import { documentChunks, documents, processingJobs } from '../../core/db/schema.js';

export interface DocumentRecord extends DocumentDTO {
  storagePublicId: string;
  sha256Hash: string;
}

export interface CreateDocumentWithJobInput {
  userId: string;
  title: string;
  originalFilename: string;
  fileType: DocumentFormat;
  fileSize: number;
  storageUrl: string;
  storagePublicId: string;
  sha256Hash: string;
}

export interface ListDocumentsFilter {
  page: number;
  limit: number;
  fileType?: DocumentFormat;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface IDocumentRepository {
  createDocumentWithJob(
    input: CreateDocumentWithJobInput
  ): Promise<{ document: DocumentDTO; jobId: string }>;
  listByUser(
    userId: string,
    filter: ListDocumentsFilter
  ): Promise<{ items: DocumentDTO[]; totalItems: number }>;
  findByIdForUser(
    documentId: string,
    userId: string
  ): Promise<{ document: DocumentRecord; chunks: DocumentChunkDTO[] } | null>;
  deleteByIdForUser(documentId: string, userId: string): Promise<boolean>;
}

function toDocumentDTO(row: typeof documents.$inferSelect): DocumentDTO {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    originalFilename: row.originalFilename,
    fileType: row.fileType,
    fileSize: row.fileSize,
    status: row.status,
    chunkCount: row.chunkCount,
    storageUrl: row.storageUrl,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDocumentRecord(row: typeof documents.$inferSelect): DocumentRecord {
  return {
    ...toDocumentDTO(row),
    storagePublicId: row.storagePublicId,
    sha256Hash: row.sha256Hash,
  };
}

/**
 * Drizzle PostgreSQL repository for user-scoped documents and chunk previews.
 */
export class DrizzleDocumentRepository implements IDocumentRepository {
  async createDocumentWithJob(
    input: CreateDocumentWithJobInput
  ): Promise<{ document: DocumentDTO; jobId: string }> {
    return db.transaction(async (tx) => {
      const [docRow] = await tx
        .insert(documents)
        .values({
          userId: input.userId,
          title: input.title,
          originalFilename: input.originalFilename,
          fileType: input.fileType,
          fileSize: input.fileSize,
          storageUrl: input.storageUrl,
          storagePublicId: input.storagePublicId,
          sha256Hash: input.sha256Hash,
          status: 'pending',
          chunkCount: 0,
          metadata: {},
        })
        .returning();

      const [jobRow] = await tx
        .insert(processingJobs)
        .values({
          documentId: docRow.id,
          userId: input.userId,
          status: 'queued',
          stage: 'QUEUED',
          progress: 0,
          attemptCount: 1,
        })
        .returning({ id: processingJobs.id });

      return {
        document: toDocumentDTO(docRow),
        jobId: jobRow.id,
      };
    });
  }

  async listByUser(
    userId: string,
    filter: ListDocumentsFilter
  ): Promise<{ items: DocumentDTO[]; totalItems: number }> {
    const conditions = [eq(documents.userId, userId)];
    if (filter.fileType) {
      conditions.push(eq(documents.fileType, filter.fileType));
    }
    if (filter.status) {
      conditions.push(eq(documents.status, filter.status));
    }

    const whereClause = and(...conditions);
    const offset = (filter.page - 1) * filter.limit;

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(documents)
        .where(whereClause)
        .orderBy(desc(documents.createdAt))
        .limit(filter.limit)
        .offset(offset),
      db.select({ total: count() }).from(documents).where(whereClause),
    ]);

    return {
      items: rows.map(toDocumentDTO),
      totalItems: Number(totalRows[0]?.total ?? 0),
    };
  }

  async findByIdForUser(
    documentId: string,
    userId: string
  ): Promise<{ document: DocumentRecord; chunks: DocumentChunkDTO[] } | null> {
    const docRows = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .limit(1);

    if (!docRows[0]) {
      return null;
    }

    const chunkRows = await db
      .select({
        id: documentChunks.id,
        documentId: documentChunks.documentId,
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        coordinates: documentChunks.coordinates,
      })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))
      .orderBy(asc(documentChunks.chunkIndex))
      .limit(20);

    return {
      document: toDocumentRecord(docRows[0]),
      chunks: chunkRows,
    };
  }

  async deleteByIdForUser(documentId: string, userId: string): Promise<boolean> {
    const deleted = await db
      .delete(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .returning({ id: documents.id });

    return deleted.length > 0;
  }
}
