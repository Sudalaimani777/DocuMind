import type { PaginationQuery, ProcessingJobDTO } from '@documind/shared';
import { BadRequestError, NotFoundError } from '../../core/errors/AppError.js';
import type { IProcessingJobRepository } from './job.repository.js';
import type { DocumentProcessingQueue } from './queue.js';
import type { SseService } from './sse.service.js';

export interface PaginatedJobsResult {
  items: ProcessingJobDTO[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
}

/**
 * Business logic for listing user-scoped processing jobs and retrying failed jobs.
 */
export class JobService {
  constructor(
    private readonly jobRepository: IProcessingJobRepository,
    private readonly processingQueue: DocumentProcessingQueue,
    private readonly sseService: SseService
  ) {}

  async listJobs(userId: string, pagination: PaginationQuery): Promise<PaginatedJobsResult> {
    const { items, totalItems } = await this.jobRepository.listByUser(userId, pagination);
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

  async retryJob(jobId: string, userId: string): Promise<ProcessingJobDTO> {
    const existing = await this.jobRepository.findByIdForUser(jobId, userId);
    if (!existing) {
      throw new NotFoundError('Processing job not found.');
    }

    if (existing.status !== 'failed') {
      throw new BadRequestError('Only failed processing jobs can be retried.');
    }

    const updated = await this.jobRepository.resetForRetry(jobId, userId);
    if (!updated) {
      throw new NotFoundError('Processing job not found.');
    }

    await this.processingQueue.enqueueDocumentJob({
      jobId: updated.id,
      documentId: updated.documentId,
      userId: updated.userId,
      fileType: updated.fileType,
      storageUrl: updated.storageUrl,
    });

    this.sseService.emitProgress({
      jobId: updated.id,
      documentId: updated.documentId,
      userId: updated.userId,
      status: 'queued',
      stage: 'QUEUED',
      progress: 0,
    });

    return {
      id: updated.id,
      documentId: updated.documentId,
      status: updated.status,
      stage: updated.stage,
      progress: updated.progress,
      attemptCount: updated.attemptCount,
      ...(updated.errorLog ? { errorLog: updated.errorLog } : {}),
    };
  }
}
