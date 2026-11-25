import { Queue } from 'bullmq';
import type { DocumentFormat } from '@documind/shared';
import { unifiedConfig } from '../../core/config/unifiedConfig.js';
import { buildRedisOptions } from '../../core/redis/index.js';

export const DOCUMENT_PROCESSING_QUEUE = 'document-processing';

export interface DocumentProcessingJobData {
  jobId: string;
  documentId: string;
  userId: string;
  fileType: DocumentFormat;
  storageUrl: string;
}

export interface BullQueueLike {
  add(
    name: string,
    data: DocumentProcessingJobData,
    opts: Record<string, unknown>
  ): Promise<{ id?: string }>;
  close(): Promise<void>;
}

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: 100,
  removeOnFail: 200,
} as const;

/**
 * Producer wrapper for the BullMQ document-processing queue.
 */
export class DocumentProcessingQueue {
  private bullQueue: BullQueueLike | null;

  constructor(queue?: BullQueueLike) {
    this.bullQueue = queue ?? null;
  }

  private getQueue(): BullQueueLike {
    if (!this.bullQueue) {
      this.bullQueue = new Queue<DocumentProcessingJobData>(DOCUMENT_PROCESSING_QUEUE, {
        connection: {
          url: unifiedConfig.redis.url,
          ...buildRedisOptions(),
        },
      }) as unknown as BullQueueLike;
    }
    return this.bullQueue;
  }

  async enqueueDocumentJob(data: DocumentProcessingJobData): Promise<string | undefined> {
    const job = await this.getQueue().add(
      DOCUMENT_PROCESSING_QUEUE,
      data,
      DEFAULT_JOB_OPTIONS
    );
    return job.id;
  }

  async close(): Promise<void> {
    if (this.bullQueue) {
      await this.bullQueue.close();
      this.bullQueue = null;
    }
  }
}

export const documentProcessingQueue = new DocumentProcessingQueue();

export async function enqueueDocumentJob(
  data: DocumentProcessingJobData
): Promise<string | undefined> {
  return documentProcessingQueue.enqueueDocumentJob(data);
}
