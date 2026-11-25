import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { DocumentFormat, ProcessingJobDTO } from '@documind/shared';
import { db } from '../../core/db/index.js';
import { documents, processingJobs } from '../../core/db/schema.js';

export interface ProcessingJobWithDoc extends ProcessingJobDTO {
  userId: string;
  fileType: DocumentFormat;
  storageUrl: string;
}

export interface IProcessingJobRepository {
  listByUser(
    userId: string,
    pagination: { page: number; limit: number }
  ): Promise<{ items: ProcessingJobDTO[]; totalItems: number }>;
  findByIdForUser(jobId: string, userId: string): Promise<ProcessingJobWithDoc | null>;
  resetForRetry(jobId: string, userId: string): Promise<ProcessingJobWithDoc | null>;
}

function toJobDTO(row: typeof processingJobs.$inferSelect): ProcessingJobDTO {
  return {
    id: row.id,
    documentId: row.documentId,
    status: row.status,
    stage: row.stage,
    progress: row.progress,
    attemptCount: row.attemptCount,
    ...(row.errorLog ? { errorLog: row.errorLog } : {}),
  };
}

/**
 * Drizzle PostgreSQL repository for user-scoped processing jobs.
 */
export class DrizzleProcessingJobRepository implements IProcessingJobRepository {
  async listByUser(
    userId: string,
    pagination: { page: number; limit: number }
  ): Promise<{ items: ProcessingJobDTO[]; totalItems: number }> {
    const offset = (pagination.page - 1) * pagination.limit;

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(processingJobs)
        .where(eq(processingJobs.userId, userId))
        .orderBy(desc(processingJobs.createdAt))
        .limit(pagination.limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(processingJobs)
        .where(eq(processingJobs.userId, userId)),
    ]);

    return {
      items: rows.map(toJobDTO),
      totalItems: Number(totalRows[0]?.total ?? 0),
    };
  }

  async findByIdForUser(jobId: string, userId: string): Promise<ProcessingJobWithDoc | null> {
    const rows = await db
      .select({
        job: processingJobs,
        fileType: documents.fileType,
        storageUrl: documents.storageUrl,
      })
      .from(processingJobs)
      .innerJoin(documents, eq(processingJobs.documentId, documents.id))
      .where(and(eq(processingJobs.id, jobId), eq(processingJobs.userId, userId)))
      .limit(1);

    if (!rows[0]) {
      return null;
    }

    const { job, fileType, storageUrl } = rows[0];
    return {
      ...toJobDTO(job),
      userId: job.userId,
      fileType: fileType as DocumentFormat,
      storageUrl,
    };
  }

  async resetForRetry(jobId: string, userId: string): Promise<ProcessingJobWithDoc | null> {
    const updatedRows = await db
      .update(processingJobs)
      .set({
        status: 'queued',
        stage: 'QUEUED',
        progress: 0,
        errorLog: null,
        completedAt: null,
        attemptCount: sql`${processingJobs.attemptCount} + 1`,
      })
      .where(and(eq(processingJobs.id, jobId), eq(processingJobs.userId, userId)))
      .returning();

    if (!updatedRows[0]) {
      return null;
    }

    return this.findByIdForUser(jobId, userId);
  }
}
