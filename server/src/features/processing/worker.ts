import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { CoordinatesDTO } from '@documind/shared';
import { unifiedConfig } from '../../core/config/unifiedConfig.js';
import { db } from '../../core/db/index.js';
import { documentChunks, documents, processingJobs } from '../../core/db/schema.js';
import { buildRedisOptions } from '../../core/redis/index.js';
import { createAIProvider } from '../ai/ai.factory.js';
import type { AIProvider } from '../ai/ai.provider.js';
import { chunkDocumentContent } from '../chunking/chunker.service.js';
import { extractDocumentContent } from '../extractors/extractors.service.js';
import {
  DOCUMENT_PROCESSING_QUEUE,
  type DocumentProcessingJobData,
} from './queue.js';
import { sseService as defaultSseService, type SseService } from './sse.service.js';

export interface NewChunkRecord {
  chunkIndex: number;
  content: string;
  coordinates: CoordinatesDTO;
  embedding: number[];
  tokenCount: number;
}

export interface IIngestionRepository {
  updateJobState(
    jobId: string,
    update: {
      status: string;
      stage: string;
      progress: number;
      errorLog?: string | null;
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<void>;
  updateDocumentState(
    documentId: string,
    update: {
      status: string;
      chunkCount?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void>;
  replaceDocumentChunks(
    documentId: string,
    chunks: NewChunkRecord[],
    metadata: Record<string, unknown>
  ): Promise<void>;
}

/**
 * Drizzle PostgreSQL persistence layer for worker ingestion state and pgvector chunks.
 */
export class DrizzleIngestionRepository implements IIngestionRepository {
  async updateJobState(
    jobId: string,
    update: {
      status: string;
      stage: string;
      progress: number;
      errorLog?: string | null;
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<void> {
    await db
      .update(processingJobs)
      .set({
        status: update.status,
        stage: update.stage,
        progress: update.progress,
        ...(update.errorLog !== undefined ? { errorLog: update.errorLog } : {}),
        ...(update.startedAt !== undefined ? { startedAt: update.startedAt } : {}),
        ...(update.completedAt !== undefined ? { completedAt: update.completedAt } : {}),
      })
      .where(eq(processingJobs.id, jobId));
  }

  async updateDocumentState(
    documentId: string,
    update: {
      status: string;
      chunkCount?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    await db
      .update(documents)
      .set({
        status: update.status,
        updatedAt: new Date(),
        ...(update.chunkCount !== undefined ? { chunkCount: update.chunkCount } : {}),
        ...(update.metadata !== undefined ? { metadata: update.metadata } : {}),
      })
      .where(eq(documents.id, documentId));
  }

  async replaceDocumentChunks(
    documentId: string,
    chunks: NewChunkRecord[],
    metadata: Record<string, unknown>
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(documentChunks).where(eq(documentChunks.documentId, documentId));

      if (chunks.length > 0) {
        await tx.insert(documentChunks).values(
          chunks.map((chunk) => ({
            documentId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            coordinates: chunk.coordinates,
            embedding: chunk.embedding,
            tokenCount: chunk.tokenCount,
          }))
        );
      }

      await tx
        .update(documents)
        .set({
          status: 'completed',
          chunkCount: chunks.length,
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));
    });
  }
}

export interface IngestionProcessorDeps {
  repository?: IIngestionRepository;
  aiProvider?: AIProvider;
  sseService?: SseService;
  downloadBuffer?: (url: string) => Promise<Buffer>;
}

async function defaultDownloadBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download source document (${response.status})`);
  }
  const arrayBuf = await response.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Orchestrates the full asynchronous ingestion pipeline:
 * Download -> Extract -> Chunk -> 768-dim Embed -> Persist Chunks -> Emit SSE.
 */
export class DocumentIngestionProcessor {
  private readonly repository: IIngestionRepository;
  private readonly aiProvider: AIProvider;
  private readonly sseService: SseService;
  private readonly downloadBuffer: (url: string) => Promise<Buffer>;

  constructor(deps: IngestionProcessorDeps = {}) {
    this.repository = deps.repository ?? new DrizzleIngestionRepository();
    this.aiProvider = deps.aiProvider ?? createAIProvider();
    this.sseService = deps.sseService ?? defaultSseService;
    this.downloadBuffer = deps.downloadBuffer ?? defaultDownloadBuffer;
  }

  async processJob(jobData: DocumentProcessingJobData): Promise<void> {
    const { jobId, documentId, userId, fileType, storageUrl } = jobData;

    try {
      await this.repository.updateDocumentState(documentId, { status: 'processing' });
      await this.repository.updateJobState(jobId, {
        status: 'active',
        stage: 'EXTRACTING',
        progress: 15,
        errorLog: null,
        startedAt: new Date(),
      });
      this.sseService.emitProgress({
        jobId,
        documentId,
        userId,
        status: 'active',
        stage: 'EXTRACTING',
        progress: 15,
      });

      const buffer = await this.downloadBuffer(storageUrl);
      const extraction = await extractDocumentContent(buffer, fileType);

      if (extraction.isScanned || extraction.segments.length === 0) {
        await this.repository.updateDocumentState(documentId, {
          status: 'completed',
          chunkCount: 0,
          metadata: extraction.metadata,
        });
        await this.repository.updateJobState(jobId, {
          status: 'completed',
          stage: 'COMPLETED',
          progress: 100,
          completedAt: new Date(),
        });
        this.sseService.emitProgress({
          jobId,
          documentId,
          userId,
          status: 'completed',
          stage: 'COMPLETED',
          progress: 100,
        });
        return;
      }

      await this.repository.updateJobState(jobId, {
        status: 'active',
        stage: 'CHUNKING',
        progress: 45,
      });
      this.sseService.emitProgress({
        jobId,
        documentId,
        userId,
        status: 'active',
        stage: 'CHUNKING',
        progress: 45,
      });

      const chunks = chunkDocumentContent(extraction.segments);

      await this.repository.updateJobState(jobId, {
        status: 'active',
        stage: 'EMBEDDING',
        progress: 70,
      });
      this.sseService.emitProgress({
        jobId,
        documentId,
        userId,
        status: 'active',
        stage: 'EMBEDDING',
        progress: 70,
      });

      const embeddings = await this.aiProvider.generateBatchEmbeddings(
        chunks.map((c) => c.content)
      );

      const records: NewChunkRecord[] = chunks.map((chunk, idx) => ({
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        coordinates: chunk.coordinates,
        embedding: embeddings[idx],
        tokenCount: chunk.tokenCount,
      }));

      await this.repository.replaceDocumentChunks(
        documentId,
        records,
        extraction.metadata
      );

      await this.repository.updateJobState(jobId, {
        status: 'completed',
        stage: 'COMPLETED',
        progress: 100,
        completedAt: new Date(),
      });
      this.sseService.emitProgress({
        jobId,
        documentId,
        userId,
        status: 'completed',
        stage: 'COMPLETED',
        progress: 100,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown ingestion error';

      await this.repository.updateDocumentState(documentId, { status: 'failed' });
      await this.repository.updateJobState(jobId, {
        status: 'failed',
        stage: 'FAILED',
        progress: 0,
        errorLog: errorMessage,
        completedAt: new Date(),
      });
      this.sseService.emitProgress({
        jobId,
        documentId,
        userId,
        status: 'failed',
        stage: 'FAILED',
        progress: 0,
        errorLog: errorMessage,
      });

      throw error;
    }
  }
}

/**
 * Starts the BullMQ document-processing worker against Redis.
 */
export function startDocumentWorker(
  processor: DocumentIngestionProcessor = new DocumentIngestionProcessor()
): Worker<DocumentProcessingJobData> {
  return new Worker<DocumentProcessingJobData>(
    DOCUMENT_PROCESSING_QUEUE,
    async (job: Job<DocumentProcessingJobData>) => {
      await processor.processJob(job.data);
    },
    {
      connection: {
        url: unifiedConfig.redis.url,
        ...buildRedisOptions(),
      },
      concurrency: 2,
    }
  );
}
