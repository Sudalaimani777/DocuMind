import { describe, it, expect, beforeEach } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import crypto from 'node:crypto';
import type { DocumentFormat, ProcessingJobDTO } from '@documind/shared';
import { buildRedisOptions } from '../src/core/redis/index.js';
import {
  DOCUMENT_PROCESSING_QUEUE,
  DocumentProcessingQueue,
  type BullQueueLike,
  type DocumentProcessingJobData,
} from '../src/features/processing/queue.js';
import {
  SseService,
  type ProcessingProgressEvent,
} from '../src/features/processing/sse.service.js';
import {
  type IProcessingJobRepository,
  type ProcessingJobWithDoc,
} from '../src/features/processing/job.repository.js';
import { JobService } from '../src/features/processing/job.service.js';
import { signAccessToken, ACCESS_TOKEN_COOKIE } from '../src/core/utils/jwt.js';
import { createApp } from '../src/app.js';

class InMemoryBullQueue implements BullQueueLike {
  public readonly enqueued: Array<{
    name: string;
    data: DocumentProcessingJobData;
    opts: Record<string, unknown>;
  }> = [];

  async add(
    name: string,
    data: DocumentProcessingJobData,
    opts: Record<string, unknown>
  ): Promise<{ id?: string }> {
    this.enqueued.push({ name, data, opts });
    return { id: `bull-${this.enqueued.length}` };
  }

  async close(): Promise<void> {}
}

class InMemoryProcessingJobRepository implements IProcessingJobRepository {
  private readonly jobs = new Map<string, ProcessingJobWithDoc>();

  seed(job: ProcessingJobWithDoc): void {
    this.jobs.set(job.id, { ...job });
  }

  async listByUser(
    userId: string,
    pagination: { page: number; limit: number }
  ): Promise<{ items: ProcessingJobDTO[]; totalItems: number }> {
    const owned = Array.from(this.jobs.values()).filter((j) => j.userId === userId);
    const start = (pagination.page - 1) * pagination.limit;
    const paged = owned.slice(start, start + pagination.limit).map((j) => ({
      id: j.id,
      documentId: j.documentId,
      status: j.status,
      stage: j.stage,
      progress: j.progress,
      attemptCount: j.attemptCount,
      ...(j.errorLog ? { errorLog: j.errorLog } : {}),
    }));
    return { items: paged, totalItems: owned.length };
  }

  async findByIdForUser(jobId: string, userId: string): Promise<ProcessingJobWithDoc | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) {
      return null;
    }
    return { ...job };
  }

  async resetForRetry(jobId: string, userId: string): Promise<ProcessingJobWithDoc | null> {
    const existing = this.jobs.get(jobId);
    if (!existing || existing.userId !== userId) {
      return null;
    }
    const updated: ProcessingJobWithDoc = {
      ...existing,
      status: 'queued',
      stage: 'QUEUED',
      progress: 0,
      attemptCount: existing.attemptCount + 1,
      errorLog: undefined,
    };
    this.jobs.set(jobId, updated);
    return { ...updated };
  }
}

function makeAuthCookie(userId: string, email = 'user@example.com'): string {
  const token = signAccessToken({
    id: userId,
    email,
    name: 'Test User',
    organization: 'Acme Corp',
  });
  return `${ACCESS_TOKEN_COOKIE}=${token}`;
}

describe('Milestone 1.5: Asynchronous Background Processing Queue (BullMQ + Redis)', () => {
  describe('Redis Connection Options', () => {
    it('configures maxRetriesPerRequest=null and exponential retryStrategy for BullMQ', () => {
      const opts = buildRedisOptions();
      expect(opts.maxRetriesPerRequest).toBeNull();
      expect(opts.lazyConnect).toBe(true);
      expect(typeof opts.retryStrategy).toBe('function');
      expect(opts.retryStrategy?.(1)).toBeGreaterThan(0);
    });
  });

  describe('BullMQ Queue & Producer', () => {
    it('enqueues document job with 3 attempts and exponential backoff (5s base delay)', async () => {
      const fakeBull = new InMemoryBullQueue();
      const queue = new DocumentProcessingQueue(fakeBull);

      const jobData: DocumentProcessingJobData = {
        jobId: crypto.randomUUID(),
        documentId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        fileType: 'pdf' as DocumentFormat,
        storageUrl: 'https://res.cloudinary.com/demo/raw/upload/doc.pdf',
      };

      const bullId = await queue.enqueueDocumentJob(jobData);
      expect(bullId).toBe('bull-1');
      expect(fakeBull.enqueued).toHaveLength(1);
      expect(fakeBull.enqueued[0].name).toBe(DOCUMENT_PROCESSING_QUEUE);
      expect(fakeBull.enqueued[0].data).toEqual(jobData);
      expect(fakeBull.enqueued[0].opts.attempts).toBe(3);
      expect(fakeBull.enqueued[0].opts.backoff).toEqual({
        type: 'exponential',
        delay: 5000,
      });
    });
  });

  describe('SSE Progress Event Bus', () => {
    it('delivers stage transitions only to subscribers of that user and cleans up on unsubscribe', () => {
      const sse = new SseService();
      const user1Events: ProcessingProgressEvent[] = [];
      const user2Events: ProcessingProgressEvent[] = [];

      const unsub1 = sse.subscribe('user-1', (evt) => user1Events.push(evt));
      const unsub2 = sse.subscribe('user-2', (evt) => user2Events.push(evt));

      const stages = ['QUEUED', 'EXTRACTING', 'CHUNKING', 'EMBEDDING', 'COMPLETED'] as const;
      stages.forEach((stage, idx) => {
        sse.emitProgress({
          jobId: 'job-1',
          documentId: 'doc-1',
          userId: 'user-1',
          status: stage === 'COMPLETED' ? 'completed' : stage === 'QUEUED' ? 'queued' : 'active',
          stage,
          progress: idx * 25,
        });
      });

      expect(user1Events.map((e) => e.stage)).toEqual([...stages]);
      expect(user2Events).toHaveLength(0);

      unsub1();
      unsub2();

      sse.emitProgress({
        jobId: 'job-1',
        documentId: 'doc-1',
        userId: 'user-1',
        status: 'failed',
        stage: 'FAILED',
        progress: 50,
      });
      expect(user1Events).toHaveLength(5);
    });
  });

  describe('Jobs & SSE HTTP Endpoints', () => {
    const user1Id = '11111111-1111-4111-8111-111111111111';
    const user2Id = '22222222-2222-4222-8222-222222222222';
    const failedJobId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const completedJobId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const otherUserJobId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    let repo: InMemoryProcessingJobRepository;
    let fakeBull: InMemoryBullQueue;
    let sseService: SseService;
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
      repo = new InMemoryProcessingJobRepository();
      fakeBull = new InMemoryBullQueue();
      sseService = new SseService();

      repo.seed({
        id: failedJobId,
        documentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        userId: user1Id,
        fileType: 'pdf',
        storageUrl: 'https://res.cloudinary.com/demo/raw/upload/failed.pdf',
        status: 'failed',
        stage: 'FAILED',
        progress: 25,
        attemptCount: 1,
        errorLog: 'Timeout extracting PDF',
      });
      repo.seed({
        id: completedJobId,
        documentId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        userId: user1Id,
        fileType: 'docx',
        storageUrl: 'https://res.cloudinary.com/demo/raw/upload/done.docx',
        status: 'completed',
        stage: 'COMPLETED',
        progress: 100,
        attemptCount: 1,
      });
      repo.seed({
        id: otherUserJobId,
        documentId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        userId: user2Id,
        fileType: 'xlsx',
        storageUrl: 'https://res.cloudinary.com/demo/raw/upload/other.xlsx',
        status: 'failed',
        stage: 'FAILED',
        progress: 10,
        attemptCount: 1,
      });

      const queue = new DocumentProcessingQueue(fakeBull);
      const jobService = new JobService(repo, queue, sseService);
      app = createApp({ jobService, sseService });
    });

    it('lists only the authenticated user jobs on GET /api/v1/jobs', async () => {
      const unauth = await request(app).get('/api/v1/jobs');
      expect(unauth.status).toBe(401);

      const res = await request(app)
        .get('/api/v1/jobs?page=1&limit=10')
        .set('Cookie', makeAuthCookie(user1Id));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.items.map((j: ProcessingJobDTO) => j.id)).not.toContain(otherUserJobId);
      expect(res.body.data.pagination).toEqual({
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        limit: 10,
      });
    });

    it('re-enqueues a failed user-owned job on POST /api/v1/jobs/:id/retry and emits SSE QUEUED', async () => {
      const emitted: ProcessingProgressEvent[] = [];
      const unsub = sseService.subscribe(user1Id, (evt) => emitted.push(evt));

      const res = await request(app)
        .post(`/api/v1/jobs/${failedJobId}/retry`)
        .set('Cookie', makeAuthCookie(user1Id));

      unsub();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.job.status).toBe('queued');
      expect(res.body.data.job.stage).toBe('QUEUED');
      expect(res.body.data.job.attemptCount).toBe(2);
      expect(fakeBull.enqueued).toHaveLength(1);
      expect(fakeBull.enqueued[0].data.jobId).toBe(failedJobId);
      expect(emitted).toHaveLength(1);
      expect(emitted[0].stage).toBe('QUEUED');
    });

    it('rejects retrying another user job (404), non-failed job (400), and invalid UUID (400)', async () => {
      const badUuid = await request(app)
        .post('/api/v1/jobs/not-a-uuid/retry')
        .set('Cookie', makeAuthCookie(user1Id));
      expect(badUuid.status).toBe(400);

      const otherUser = await request(app)
        .post(`/api/v1/jobs/${otherUserJobId}/retry`)
        .set('Cookie', makeAuthCookie(user1Id));
      expect(otherUser.status).toBe(404);

      const alreadyDone = await request(app)
        .post(`/api/v1/jobs/${completedJobId}/retry`)
        .set('Cookie', makeAuthCookie(user1Id));
      expect(alreadyDone.status).toBe(400);
    });

    it('streams real-time SSE progress events on GET /api/v1/processing/events', async () => {
      const unauth = await request(app).get('/api/v1/processing/events');
      expect(unauth.status).toBe(401);

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to bind test server');
      }

      const chunks: string[] = [];
      try {
        await new Promise<void>((resolve, reject) => {
          const req = http.get(
            {
              hostname: '127.0.0.1',
              port: address.port,
              path: '/api/v1/processing/events',
              headers: {
                Cookie: makeAuthCookie(user1Id),
              },
            },
            (res) => {
              expect(res.statusCode).toBe(200);
              expect(res.headers['content-type']).toContain('text/event-stream');

              res.on('data', (chunk: Buffer) => {
                const text = chunk.toString('utf8');
                chunks.push(text);
                if (text.includes('event: connected')) {
                  sseService.emitProgress({
                    jobId: failedJobId,
                    documentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                    userId: user1Id,
                    status: 'active',
                    stage: 'EXTRACTING',
                    progress: 25,
                  });
                }
                if (chunks.join('').includes('EXTRACTING')) {
                  req.destroy();
                  resolve();
                }
              });
              res.on('error', reject);
            }
          );
          req.on('error', (err) => {
            if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') {
              reject(err);
            }
          });
        });
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }

      const streamOutput = chunks.join('');
      expect(streamOutput).toContain('event: progress');
      expect(streamOutput).toContain('"stage":"EXTRACTING"');
      expect(streamOutput).toContain('"progress":25');
    });
  });
});
