import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Writable } from 'node:stream';
import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  uploadDocumentsMiddleware,
} from '../src/core/middleware/upload.middleware.js';
import { validateMagicBytes } from '../src/core/middleware/validateMagicBytes.js';
import { errorHandler } from '../src/core/middleware/errorHandler.js';
import { computeSha256 } from '../src/features/storage/hasher.service.js';
import {
  DeduplicationService,
  type IDocumentDeduplicationRepository,
  type ExistingDocumentRef,
} from '../src/features/storage/deduplication.service.js';
import {
  CloudinaryService,
  type CloudinaryUploader,
} from '../src/features/storage/cloudinary.service.js';
import { ConflictError } from '../src/core/errors/AppError.js';

class InMemoryDeduplicationRepository implements IDocumentDeduplicationRepository {
  private readonly records: Array<{
    userId: string;
    sha256Hash: string;
    doc: ExistingDocumentRef;
  }> = [];

  seed(userId: string, sha256Hash: string, doc: ExistingDocumentRef): void {
    this.records.push({ userId, sha256Hash, doc });
  }

  async findByUserAndHash(
    userId: string,
    sha256Hash: string
  ): Promise<ExistingDocumentRef | null> {
    const match = this.records.find(
      (r) => r.userId === userId && r.sha256Hash === sha256Hash
    );
    return match ? match.doc : null;
  }
}

describe('Milestone 1.4: Ingestion Security & Cloudinary Streaming Storage', () => {
  describe('Multer Memory Upload & Magic Bytes Validation', () => {
    function buildUploadTestApp() {
      const app = express();
      app.post(
        '/upload',
        uploadDocumentsMiddleware,
        validateMagicBytes,
        (req, res) => {
          res.status(200).json({
            success: true,
            files: req.validatedFiles ?? [],
          });
        }
      );
      app.use(errorHandler);
      return app;
    }

    it('enforces a 25MB max file size constant', () => {
      expect(MAX_UPLOAD_FILE_SIZE_BYTES).toBe(25 * 1024 * 1024);
    });

    it('rejects files with spoofed .pdf extension and non-PDF magic bytes', async () => {
      const app = buildUploadTestApp();
      const spoofedHtml = Buffer.from('<html><script>alert(1)</script></html>');

      const res = await request(app)
        .post('/upload')
        .attach('files', spoofedHtml, {
          filename: 'malicious.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('rejects unsupported MIME types at Multer fileFilter', async () => {
      const app = buildUploadTestApp();

      const res = await request(app)
        .post('/upload')
        .attach('files', Buffer.from('plain text'), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('accepts valid PDF magic bytes and sanitizes the original filename', async () => {
      const app = buildUploadTestApp();
      const validPdfHeader = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n%%EOF');

      const res = await request(app)
        .post('/upload')
        .attach('files', validPdfHeader, {
          filename: '../../evil..report?.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.files).toHaveLength(1);
      expect(res.body.files[0].fileType).toBe('pdf');
      expect(res.body.files[0].detectedMime).toBe('application/pdf');
      expect(res.body.files[0].sanitizedFilename).not.toContain('..');
      expect(res.body.files[0].sanitizedFilename).not.toContain('/');
    });
  });

  describe('SHA-256 Hashing & Per-User Deduplication', () => {
    it('computes deterministic 64-char SHA-256 hex digests', () => {
      const bufA = Buffer.from('DocuMind binary payload');
      const bufB = Buffer.from('DocuMind binary payload');
      const bufC = Buffer.from('Different payload');

      expect(computeSha256(bufA)).toBe(computeSha256(bufB));
      expect(computeSha256(bufA)).not.toBe(computeSha256(bufC));
      expect(computeSha256(bufA)).toHaveLength(64);
    });

    it('throws 409 ConflictError when the same user uploads a duplicate buffer, but allows another user', async () => {
      const repo = new InMemoryDeduplicationRepository();
      const dedup = new DeduplicationService(repo);
      const buffer = Buffer.from('Quarterly Financial Report Bytes');
      const hash = computeSha256(buffer);

      repo.seed('user-1', hash, {
        id: 'existing-doc-123',
        title: 'Quarterly Financial Report',
        originalFilename: 'q3.pdf',
      });

      await expect(dedup.assertUniqueForUser('user-1', buffer)).rejects.toThrow(
        ConflictError
      );

      try {
        await dedup.assertUniqueForUser('user-1', buffer);
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        expect((err as ConflictError).statusCode).toBe(409);
        expect((err as ConflictError).details).toEqual({
          existingDocumentId: 'existing-doc-123',
          title: 'Quarterly Financial Report',
          originalFilename: 'q3.pdf',
        });
      }

      const user2Hash = await dedup.assertUniqueForUser('user-2', buffer);
      expect(user2Hash).toBe(hash);
    });
  });

  describe('Cloudinary Streaming Service', () => {
    it('streams raw file buffer to documind folder with UUID public_id and deletes raw asset', async () => {
      const streamedChunks: Buffer[] = [];
      let capturedOptions: Record<string, unknown> | undefined;
      let destroyedPublicId: string | undefined;
      let destroyedOptions: Record<string, unknown> | undefined;

      const fakeUploader: CloudinaryUploader = {
        upload_stream(options, callback) {
          capturedOptions = options;
          return new Writable({
            write(chunk, _encoding, next) {
              streamedChunks.push(Buffer.from(chunk));
              next();
            },
            final(next) {
              const publicId = `documind/${String(options.public_id)}`;
              callback(undefined, {
                public_id: publicId,
                secure_url: `https://res.cloudinary.com/demo/raw/upload/${publicId}`,
                bytes: Buffer.concat(streamedChunks).length,
              });
              next();
            },
          });
        },
        async destroy(publicId, options) {
          destroyedPublicId = publicId;
          destroyedOptions = options;
          return { result: 'ok' };
        },
      };

      const service = new CloudinaryService(fakeUploader);
      const input = Buffer.from('Sample binary PDF bytes');
      const result = await service.uploadRaw(input);

      expect(Buffer.concat(streamedChunks).equals(input)).toBe(true);
      expect(capturedOptions?.resource_type).toBe('raw');
      expect(capturedOptions?.folder).toBe('documind');
      expect(typeof capturedOptions?.public_id).toBe('string');
      expect((capturedOptions?.public_id as string).length).toBeGreaterThan(10);
      expect(result.secureUrl).toContain('https://res.cloudinary.com/');
      expect(result.bytes).toBe(input.length);

      await service.deleteRaw(result.publicId);
      expect(destroyedPublicId).toBe(result.publicId);
      expect(destroyedOptions).toEqual({ resource_type: 'raw' });
    });
  });
});
