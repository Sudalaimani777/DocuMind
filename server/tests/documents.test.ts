import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { Writable } from 'node:stream';
import type { DocumentChunkDTO, DocumentDTO } from '@documind/shared';
import { createApp } from '../src/app.js';
import { signAccessToken, ACCESS_TOKEN_COOKIE } from '../src/core/utils/jwt.js';
import {
  CloudinaryService,
  type CloudinaryUploader,
} from '../src/features/storage/cloudinary.service.js';
import {
  DeduplicationService,
  type ExistingDocumentRef,
  type IDocumentDeduplicationRepository,
} from '../src/features/storage/deduplication.service.js';
import {
  DocumentProcessingQueue,
  type BullQueueLike,
  type DocumentProcessingJobData,
} from '../src/features/processing/queue.js';
import { SseService, type ProcessingProgressEvent } from '../src/features/processing/sse.service.js';
import type {
  CreateDocumentWithJobInput,
  DocumentRecord,
  IDocumentRepository,
  ListDocumentsFilter,
} from '../src/features/documents/document.repository.js';
import { DocumentService } from '../src/features/documents/document.service.js';

class InMemoryDocumentRepository
  implements IDocumentRepository, IDocumentDeduplicationRepository
{
  public readonly docs = new Map<string, DocumentRecord>();
  public readonly chunksByDocId = new Map<string, DocumentChunkDTO[]>();
  public readonly jobsByDocId = new Map<string, { id: string; userId: string }>();

  async findByUserAndHash(
    userId: string,
    sha256Hash: string
  ): Promise<ExistingDocumentRef | null> {
    for (const doc of this.docs.values()) {
      if (doc.userId === userId && doc.sha256Hash === sha256Hash) {
        return {
          id: doc.id,
          title: doc.title,
          originalFilename: doc.originalFilename,
        };
      }
    }
    return null;
  }

  async createDocumentWithJob(
    input: CreateDocumentWithJobInput
  ): Promise<{ document: DocumentDTO; jobId: string }> {
    const id = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    const record: DocumentRecord = {
      id,
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
      createdAt: now,
    };

    this.docs.set(id, record);
    this.jobsByDocId.set(id, { id: jobId, userId: input.userId });

    return {
      document: this.toDTO(record),
      jobId,
    };
  }

  async listByUser(
    userId: string,
    filter: ListDocumentsFilter
  ): Promise<{ items: DocumentDTO[]; totalItems: number }> {
    let items = Array.from(this.docs.values()).filter((d) => d.userId === userId);
    if (filter.fileType) {
      items = items.filter((d) => d.fileType === filter.fileType);
    }
    if (filter.status) {
      items = items.filter((d) => d.status === filter.status);
    }

    const totalItems = items.length;
    const start = (filter.page - 1) * filter.limit;
    const sliced = items.slice(start, start + filter.limit).map((d) => this.toDTO(d));
    return { items: sliced, totalItems };
  }

  async findByIdForUser(
    documentId: string,
    userId: string
  ): Promise<{ document: DocumentRecord; chunks: DocumentChunkDTO[] } | null> {
    const doc = this.docs.get(documentId);
    if (!doc || doc.userId !== userId) {
      return null;
    }
    return {
      document: { ...doc },
      chunks: [...(this.chunksByDocId.get(documentId) ?? [])],
    };
  }

  async deleteByIdForUser(documentId: string, userId: string): Promise<boolean> {
    const doc = this.docs.get(documentId);
    if (!doc || doc.userId !== userId) {
      return false;
    }
    this.docs.delete(documentId);
    this.chunksByDocId.delete(documentId);
    this.jobsByDocId.delete(documentId);
    return true;
  }

  private toDTO(record: DocumentRecord): DocumentDTO {
    return {
      id: record.id,
      userId: record.userId,
      title: record.title,
      originalFilename: record.originalFilename,
      fileType: record.fileType,
      fileSize: record.fileSize,
      status: record.status,
      chunkCount: record.chunkCount,
      storageUrl: record.storageUrl,
      createdAt: record.createdAt,
    };
  }
}

class FakeBullQueue implements BullQueueLike {
  public readonly enqueued: DocumentProcessingJobData[] = [];

  async add(
    _name: string,
    data: DocumentProcessingJobData,
    _opts: Record<string, unknown>
  ): Promise<{ id?: string }> {
    this.enqueued.push(data);
    return { id: `bull-${this.enqueued.length}` };
  }

  async close(): Promise<void> {}
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

describe('Milestone 1.8.1: Document Management APIs (/api/v1/documents)', () => {
  const user1Id = '11111111-1111-4111-8111-111111111111';
  const user2Id = '22222222-2222-4222-8222-222222222222';
  const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');

  let repo: InMemoryDocumentRepository;
  let fakeQueue: FakeBullQueue;
  let sseService: SseService;
  let deletedPublicIds: string[];
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    repo = new InMemoryDocumentRepository();
    fakeQueue = new FakeBullQueue();
    sseService = new SseService();
    deletedPublicIds = [];

    const fakeUploader: CloudinaryUploader = {
      upload_stream(options, callback) {
        const chunks: Buffer[] = [];
        return new Writable({
          write(chunk, _enc, next) {
            chunks.push(Buffer.from(chunk));
            next();
          },
          final(next) {
            const publicId = `${options.folder}/${options.public_id}`;
            callback(undefined, {
              public_id: publicId,
              secure_url: `https://res.cloudinary.com/demo/raw/upload/${publicId}`,
              bytes: Buffer.concat(chunks).length,
            });
            next();
          },
        });
      },
      async destroy(publicId) {
        deletedPublicIds.push(publicId);
        return { result: 'ok' };
      },
    };

    const cloudinaryService = new CloudinaryService(fakeUploader);
    const dedupService = new DeduplicationService(repo);
    const processingQueue = new DocumentProcessingQueue(fakeQueue);
    const documentService = new DocumentService(
      repo,
      dedupService,
      cloudinaryService,
      processingQueue,
      sseService
    );

    app = createApp({ documentService, sseService });
  });

  describe('POST /api/v1/documents/upload', () => {
    it('requires authentication (401 without cookie)', async () => {
      const res = await request(app)
        .post('/api/v1/documents/upload')
        .attach('files', validPdfBuffer, {
          filename: 'report.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(401);
    });

    it('streams valid file to Cloudinary, persists document+job, enqueues BullMQ, emits SSE, and returns 202', async () => {
      const events: ProcessingProgressEvent[] = [];
      const unsub = sseService.subscribe(user1Id, (e) => events.push(e));

      const res = await request(app)
        .post('/api/v1/documents/upload?title=Q3%20Report')
        .set('Cookie', makeAuthCookie(user1Id))
        .attach('files', validPdfBuffer, {
          filename: 'q3_report.pdf',
          contentType: 'application/pdf',
        });

      unsub();

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.documentId).toBeDefined();
      expect(res.body.data.jobId).toBeDefined();
      expect(res.body.data.fileType).toBe('pdf');
      expect(res.body.data.status).toBe('pending');
      expect(fakeQueue.enqueued).toHaveLength(1);
      expect(fakeQueue.enqueued[0].userId).toBe(user1Id);
      expect(events).toHaveLength(1);
      expect(events[0].stage).toBe('QUEUED');
    });

    it('rejects duplicate upload for the same user with 409 Conflict, while allowing a different user', async () => {
      const first = await request(app)
        .post('/api/v1/documents/upload')
        .set('Cookie', makeAuthCookie(user1Id))
        .attach('files', validPdfBuffer, {
          filename: 'report.pdf',
          contentType: 'application/pdf',
        });
      expect(first.status).toBe(202);

      const duplicate = await request(app)
        .post('/api/v1/documents/upload')
        .set('Cookie', makeAuthCookie(user1Id))
        .attach('files', validPdfBuffer, {
          filename: 'renamed-copy.pdf',
          contentType: 'application/pdf',
        });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.success).toBe(false);
      expect(duplicate.body.error.code).toBe('CONFLICT');

      const otherUser = await request(app)
        .post('/api/v1/documents/upload')
        .set('Cookie', makeAuthCookie(user2Id))
        .attach('files', validPdfBuffer, {
          filename: 'report.pdf',
          contentType: 'application/pdf',
        });
      expect(otherUser.status).toBe(202);
    });
  });

  describe('GET /api/v1/documents', () => {
    it('returns paginated user-scoped documents with fileType/status filtering', async () => {
      await request(app)
        .post('/api/v1/documents/upload')
        .set('Cookie', makeAuthCookie(user1Id))
        .attach('files', validPdfBuffer, {
          filename: 'user1.pdf',
          contentType: 'application/pdf',
        });

      await request(app)
        .post('/api/v1/documents/upload')
        .set('Cookie', makeAuthCookie(user2Id))
        .attach('files', validPdfBuffer, {
          filename: 'user2.pdf',
          contentType: 'application/pdf',
        });

      const res = await request(app)
        .get('/api/v1/documents?page=1&limit=10&fileType=pdf')
        .set('Cookie', makeAuthCookie(user1Id));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].userId).toBe(user1Id);
      expect(res.body.data.items[0].originalFilename).toBe('user1.pdf');
      expect(res.body.data.pagination.totalItems).toBe(1);
    });
  });

  describe('GET /api/v1/documents/:id and DELETE /api/v1/documents/:id', () => {
    it('fetches owner document details + chunks, isolates other users (404), and deletes Cloudinary + DB records', async () => {
      const uploadRes = await request(app)
        .post('/api/v1/documents/upload')
        .set('Cookie', makeAuthCookie(user1Id))
        .attach('files', validPdfBuffer, {
          filename: 'owned.pdf',
          contentType: 'application/pdf',
        });

      const docId = uploadRes.body.data.documentId as string;
      repo.chunksByDocId.set(docId, [
        {
          id: crypto.randomUUID(),
          documentId: docId,
          chunkIndex: 0,
          content: 'Preview chunk text',
          coordinates: { pageNumber: 1 },
        },
      ]);

      const badUuid = await request(app)
        .get('/api/v1/documents/not-a-uuid')
        .set('Cookie', makeAuthCookie(user1Id));
      expect(badUuid.status).toBe(400);

      const otherUserGet = await request(app)
        .get(`/api/v1/documents/${docId}`)
        .set('Cookie', makeAuthCookie(user2Id));
      expect(otherUserGet.status).toBe(404);

      const ownerGet = await request(app)
        .get(`/api/v1/documents/${docId}`)
        .set('Cookie', makeAuthCookie(user1Id));
      expect(ownerGet.status).toBe(200);
      expect(ownerGet.body.data.document.id).toBe(docId);
      expect(ownerGet.body.data.chunks).toHaveLength(1);

      const otherUserDel = await request(app)
        .delete(`/api/v1/documents/${docId}`)
        .set('Cookie', makeAuthCookie(user2Id));
      expect(otherUserDel.status).toBe(404);

      const ownerDel = await request(app)
        .delete(`/api/v1/documents/${docId}`)
        .set('Cookie', makeAuthCookie(user1Id));
      expect(ownerDel.status).toBe(200);
      expect(ownerDel.body.data.deletedId).toBe(docId);
      expect(deletedPublicIds).toHaveLength(1);
      expect(repo.docs.has(docId)).toBe(false);
    });
  });
});
