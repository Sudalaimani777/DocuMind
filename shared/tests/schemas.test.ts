import { describe, it, expect } from 'vitest';
import {
  signupSchema,
  signinSchema,
  documentUploadQuerySchema,
  paginationSchema,
  uuidParamSchema,
} from '../src/schemas.js';
import type {
  UserDTO,
  DocumentDTO,
  DocumentChunkDTO,
  CoordinatesDTO,
  ProcessingJobDTO,
  ApiResponse,
  ApiErrorResponse,
} from '../src/types.js';

describe('Shared Zod Schemas', () => {
  describe('signupSchema', () => {
    it('accepts a valid signup payload and normalizes fields', () => {
      const result = signupSchema.safeParse({
        name: '  Sudalaimani Kannan  ',
        organization: '  Acme Corp  ',
        email: '  User@Example.COM  ',
        password: 'SecurePassword123!',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Sudalaimani Kannan',
          organization: 'Acme Corp',
          email: 'user@example.com',
          password: 'SecurePassword123!',
        });
      }
    });

    it('rejects name shorter than 2 characters after trimming', () => {
      const result = signupSchema.safeParse({
        name: ' A ',
        organization: 'Acme Corp',
        email: 'user@example.com',
        password: 'SecurePassword123!',
      });

      expect(result.success).toBe(false);
    });

    it('rejects empty organization', () => {
      const result = signupSchema.safeParse({
        name: 'Sudalaimani',
        organization: '   ',
        email: 'user@example.com',
        password: 'SecurePassword123!',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid email address', () => {
      const result = signupSchema.safeParse({
        name: 'Sudalaimani',
        organization: 'Acme Corp',
        email: 'not-an-email',
        password: 'SecurePassword123!',
      });

      expect(result.success).toBe(false);
    });

    it('rejects password shorter than 8 characters', () => {
      const result = signupSchema.safeParse({
        name: 'Sudalaimani',
        organization: 'Acme Corp',
        email: 'user@example.com',
        password: 'short7',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('signinSchema', () => {
    it('accepts valid credentials and normalizes email', () => {
      const result = signinSchema.safeParse({
        email: '  USER@Example.com ',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
        expect(result.data.password).toBe('password123');
      }
    });

    it('rejects invalid email or empty password', () => {
      expect(signinSchema.safeParse({ email: 'bad', password: '123' }).success).toBe(false);
      expect(signinSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('applies default page=1 and limit=20 when omitted', () => {
      const result = paginationSchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 1, limit: 20 });
      }
    });

    it('coerces string query parameters into integers', () => {
      const result = paginationSchema.safeParse({ page: '3', limit: '50' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 3, limit: 50 });
      }
    });

    it('rejects invalid page numbers and limits exceeding 100', () => {
      expect(paginationSchema.safeParse({ page: '0' }).success).toBe(false);
      expect(paginationSchema.safeParse({ limit: '101' }).success).toBe(false);
      expect(paginationSchema.safeParse({ limit: '-5' }).success).toBe(false);
    });
  });

  describe('uuidParamSchema', () => {
    it('accepts a valid UUID', () => {
      const result = uuidParamSchema.safeParse({
        id: '1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d',
      });

      expect(result.success).toBe(true);
    });

    it('rejects malformed UUID strings', () => {
      expect(uuidParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
      expect(uuidParamSchema.safeParse({ id: '' }).success).toBe(false);
    });
  });

  describe('documentUploadQuerySchema', () => {
    it('accepts empty query object and optional trimmed title', () => {
      expect(documentUploadQuerySchema.safeParse({}).success).toBe(true);

      const withTitle = documentUploadQuerySchema.safeParse({ title: '  Q3 Report  ' });
      expect(withTitle.success).toBe(true);
      if (withTitle.success) {
        expect(withTitle.data.title).toBe('Q3 Report');
      }
    });

    it('rejects blank title or title exceeding 255 characters', () => {
      expect(documentUploadQuerySchema.safeParse({ title: '   ' }).success).toBe(false);
      expect(documentUploadQuerySchema.safeParse({ title: 'a'.repeat(256) }).success).toBe(false);
    });
  });

  describe('Shared DTO Type Contracts', () => {
    it('constructs valid DTO and API envelope shapes', () => {
      const user: UserDTO = {
        id: '1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d',
        name: 'Sudalaimani',
        organization: 'Acme Corp',
        email: 'user@example.com',
        createdAt: '2026-11-25T00:00:00.000Z',
      };

      const coords: CoordinatesDTO = { pageNumber: 1, sheetName: 'Summary', rowStart: 1, rowEnd: 10, slideNumber: 2 };
      const chunk: DocumentChunkDTO = {
        id: 'chunk-1',
        documentId: 'doc-1',
        chunkIndex: 0,
        content: 'Sample excerpt',
        coordinates: coords,
      };
      const doc: DocumentDTO = {
        id: 'doc-1',
        userId: user.id,
        title: 'Report',
        originalFilename: 'report.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        status: 'completed',
        chunkCount: 1,
        storageUrl: 'https://res.cloudinary.com/example/raw/upload/report.pdf',
        createdAt: '2026-11-25T00:00:00.000Z',
      };
      const job: ProcessingJobDTO = {
        id: 'job-1',
        documentId: doc.id,
        status: 'completed',
        stage: 'COMPLETED',
        progress: 100,
        attemptCount: 1,
      };

      const ok: ApiResponse<{ user: UserDTO; doc: DocumentDTO; chunk: DocumentChunkDTO; job: ProcessingJobDTO }> = {
        success: true,
        data: { user, doc, chunk, job },
        timestamp: '2026-11-25T00:00:00.000Z',
      };
      const err: ApiErrorResponse = {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid input' },
        timestamp: '2026-11-25T00:00:00.000Z',
      };

      expect(ok.success).toBe(true);
      expect(err.success).toBe(false);
    });
  });
});
