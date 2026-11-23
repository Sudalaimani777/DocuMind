# DocuMind Sub-Project 1: Foundation & Document Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete monorepo foundation, PostgreSQL+pgvector database layer, Cloudinary storage integration, BullMQ+Redis background ingestion pipeline, multi-format extractors (PDF, Word, Excel, PowerPoint), recursive chunker, pluggable 768-dim AI embedder (Ollama/Gemini), and the React document library and upload UI for DocuMind.

**Architecture:** Vertical feature-based architecture separating Express REST API and BullMQ worker in `server/`, React 19 + Vite + Tailwind + shadcn/ui in `client/`, and unified models in `shared/`. Uploads stream to Cloudinary while background workers extract text, preserve structural coordinates, generate embeddings, and store them in PostgreSQL with `pgvector`.

**Tech Stack:** TypeScript, React 19, Vite, Tailwind CSS, shadcn/ui, Zustand, TanStack Query, Node.js, Express, Drizzle ORM, PostgreSQL (pgvector), Redis, BullMQ, Cloudinary SDK, Multer, Zod, Vitest, Supertest.

**Spec:** `docs/superpowers/specs/2026-11-23-documind-subproject-1-ingestion-design.md`

## Global Constraints
- TypeScript strict mode must be enabled across all workspaces (`shared/`, `server/`, `client/`).
- Database schema must use Drizzle ORM with native PostgreSQL `vector('embedding', { dimensions: 768 })` and HNSW indexing.
- Raw file uploads must stream to Cloudinary; original files are not permanently stored on the local server filesystem.
- SHA-256 duplicate detection must enforce uniqueness across uploaded files.
- Ingestion must execute asynchronously in BullMQ worker threads, never blocking Express HTTP requests.
- All external API inputs (routes, queries, params, body) must be validated via Zod schemas before reaching controllers.
- Backend controllers must extend `BaseController` and use the standardized response envelope `{ success, data/error, timestamp }`.
- Frontend design must use Deep Navy (`#0B192C`) and Electric Blue (`#0066FF`), avoiding generic AI gradients or uninformative animations.

## Review Focus
1. **Corrupted or Password-Protected PDF/Office Files**: Extractor must catch parsing errors cleanly and transition job to `failed` with diagnostic `errorDetails` without crashing worker.
2. **Duplicate File Upload Race Conditions**: Concurrent uploads of the same file must be caught by PostgreSQL unique constraint on `sha256Hash` and return HTTP 409 Conflict.
3. **Empty or Scanned PDF with Zero Text**: PDF parser must detect character density < 50 characters, flag as `scanned_pdf: true` in metadata, and complete without creating 0-token empty chunks.
4. **Temporary Ollama / Gemini API Unavailability**: BullMQ worker must handle embedding API network timeouts via configured exponential backoff retries without orphan chunks.
5. **Cascading Document Deletion**: Deleting a document while it is in the queue or completed must cleanly purge all related rows from `document_chunks`, `processing_jobs`, and remote Cloudinary assets.

---

### Task 1: Monorepo Scaffolding & Shared Contract Package

**Files:**
- Create: `package.json`
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/types.ts`
- Create: `shared/src/schemas.ts`
- Create: `shared/src/index.ts`
- Test: `shared/tests/schemas.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `Document`, `DocumentChunk`, `ProcessingJob`, `DocumentUploadSchema`, `ApiResponse<T>`, `ApiErrorResponse`

- [ ] **Step 1: Write the failing test for shared Zod schemas**

```typescript
// shared/tests/schemas.test.ts
import { describe, it, expect } from 'vitest';
import { documentUploadQuerySchema, paginationSchema } from '../src/schemas';

describe('Shared Schemas', () => {
  it('validates correct pagination query parameters', () => {
    const valid = paginationSchema.safeParse({ page: '2', limit: '50' });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.page).toBe(2);
      expect(valid.data.limit).toBe(50);
    }
  });

  it('rejects invalid limit exceeding 100', () => {
    const invalid = paginationSchema.safeParse({ limit: '500' });
    expect(invalid.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/tests/schemas.test.ts`
Expected: FAIL (Cannot find module `../src/schemas` or files not created)

- [ ] **Step 3: Implement Monorepo Scaffolding and Shared Package**

```json
// package.json
{
  "name": "documind",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "shared",
    "server",
    "client"
  ],
  "scripts": {
    "dev:server": "npm --workspace=server run dev",
    "dev:client": "npm --workspace=client run dev",
    "build:shared": "npm --workspace=shared run build",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.1.8",
    "typescript": "^5.7.2"
  }
}
```

```json
// shared/package.json
{
  "name": "@documind/shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

```typescript
// shared/src/types.ts
export type DocumentFormat = 'pdf' | 'docx' | 'xlsx' | 'pptx';
export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type JobStage = 'queued' | 'extracting' | 'chunking' | 'embedding' | 'completed' | 'failed';

export interface Document {
  id: string;
  title: string;
  originalFilename: string;
  fileFormat: DocumentFormat;
  mimeType: string;
  fileSizeBytes: number;
  sha256Hash: string;
  cloudinaryPublicId: string;
  cloudinarySecureUrl: string;
  status: DocumentStatus;
  errorMessage?: string | null;
  pageCount?: number | null;
  chunkCount: number;
  extractedMetadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChunkMetadata {
  pageNumber?: number;
  slideNumber?: number;
  sheetName?: string;
  rowStart?: number;
  rowEnd?: number;
  columnRange?: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  metadata: ChunkMetadata;
  embedding?: number[];
  tokenCount?: number;
  createdAt: string;
}

export interface ProcessingJob {
  id: string;
  documentId: string;
  bullJobId?: string | null;
  stage: JobStage;
  progressPercentage: number;
  attemptCount: number;
  maxAttempts: number;
  errorDetails?: string | null;
  durationMs?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}
```

```typescript
// shared/src/schemas.ts
import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const documentFilterSchema = paginationSchema.extend({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  format: z.enum(['pdf', 'docx', 'xlsx', 'pptx']).optional(),
  search: z.string().optional(),
});
```

```typescript
// shared/src/index.ts
export * from './types';
export * from './schemas';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/tests/schemas.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json shared/
git commit -m "feat(shared): add monorepo scaffolding and shared types"
```

---

### Task 2: Database Layer & Drizzle ORM Schema (PostgreSQL + pgvector)

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/drizzle.config.ts`
- Create: `server/src/core/config/env.ts`
- Create: `server/src/core/db/index.ts`
- Create: `server/src/core/db/schema.ts`
- Test: `server/tests/db.test.ts`

**Interfaces:**
- Consumes: `@documind/shared` types
- Produces: `db`, `documents`, `documentChunks`, `processingJobs`, `categories`, `tags`, `documentTags`

- [ ] **Step 1: Write the failing test for schema definition**

```typescript
// server/tests/db.test.ts
import { describe, it, expect } from 'vitest';
import { documents, documentChunks, processingJobs } from '../src/core/db/schema';

describe('Database Schema Definitions', () => {
  it('defines documents table with required columns', () => {
    expect(documents.id).toBeDefined();
    expect(documents.sha256Hash).toBeDefined();
    expect(documents.status).toBeDefined();
  });

  it('defines document_chunks with embedding vector column', () => {
    expect(documentChunks.embedding).toBeDefined();
    expect(documentChunks.documentId).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/tests/db.test.ts`
Expected: FAIL (Cannot find module `../src/core/db/schema`)

- [ ] **Step 3: Implement Drizzle Configuration, Environment Config, and Schema**

```json
// server/package.json
{
  "name": "@documind/server",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@documind/shared": "*",
    "@google/generative-ai": "^0.21.0",
    "axios": "^1.7.9",
    "bullmq": "^5.34.5",
    "cloudinary": "^2.5.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "drizzle-orm": "^0.38.3",
    "exceljs": "^4.4.0",
    "express": "^4.21.2",
    "ioredis": "^5.4.2",
    "mammoth": "^1.9.0",
    "multer": "^1.4.5-lts.1",
    "officeparser": "^5.1.1",
    "pdf-parse": "^1.1.1",
    "pg": "^8.13.1",
    "xlsx": "^0.18.5",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/multer": "^1.4.12",
    "@types/pdf-parse": "^1.1.4",
    "@types/pg": "^8.11.10",
    "drizzle-kit": "^0.30.1",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

```typescript
// server/src/core/config/env.ts
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().default('postgresql://documind:documind_password@localhost:5432/documind_db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CLOUDINARY_CLOUD_NAME: z.string().default('test_cloud'),
  CLOUDINARY_API_KEY: z.string().default('test_key'),
  CLOUDINARY_API_SECRET: z.string().default('test_secret'),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  GEMINI_API_KEY: z.string().optional(),
  DEFAULT_AI_PROVIDER: z.enum(['ollama', 'gemini']).default('gemini'),
});

export const config = envSchema.parse(process.env);
```

```typescript
// server/src/core/db/schema.ts
import { pgTable, uuid, text, timestamp, integer, jsonb, vector, index, uniqueIndex } from 'drizzle-orm/pg-core';
import type { ChunkMetadata } from '@documind/shared';

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  originalFilename: text('original_filename').notNull(),
  fileFormat: text('file_format').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  sha256Hash: text('sha256_hash').notNull(),
  cloudinaryPublicId: text('cloudinary_public_id').notNull(),
  cloudinarySecureUrl: text('cloudinary_secure_url').notNull(),
  status: text('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  pageCount: integer('page_count'),
  chunkCount: integer('chunk_count').default(0).notNull(),
  extractedMetadata: jsonb('extracted_metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_documents_sha256').on(table.sha256Hash),
  index('idx_documents_status').on(table.status),
  index('idx_documents_created_at').on(table.createdAt),
]);

export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata').notNull().$type<ChunkMetadata>(),
  embedding: vector('embedding', { dimensions: 768 }),
  tokenCount: integer('token_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_chunks_document_id').on(table.documentId),
  index('idx_chunks_embedding').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);

export const processingJobs = pgTable('processing_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  bullJobId: text('bull_job_id'),
  stage: text('stage').notNull().default('queued'),
  progressPercentage: integer('progress_percentage').default(0).notNull(),
  attemptCount: integer('attempt_count').default(1).notNull(),
  maxAttempts: integer('max_attempts').default(3).notNull(),
  errorDetails: text('error_details'),
  durationMs: integer('duration_ms'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_processing_jobs_document_id').on(table.documentId),
  index('idx_processing_jobs_stage').on(table.stage),
]);

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const documentTags = pgTable('document_tags', {
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  index('idx_document_tags').on(table.documentId, table.tagId),
]);
```

```typescript
// server/src/core/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config/env';
import * as schema from './schema';

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/tests/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/
git commit -m "feat(server): setup drizzle schema with pgvector and environment validation"
```

---

### Task 3: Cloudinary Storage & SHA-256 Deduplication Service

**Files:**
- Create: `server/src/features/storage/hasher.service.ts`
- Create: `server/src/features/storage/cloudinary.service.ts`
- Test: `server/tests/storage.test.ts`

**Interfaces:**
- Consumes: `Buffer`, Cloudinary API
- Produces: `computeSha256(buffer: Buffer): string`, `uploadToCloudinary(buffer: Buffer, filename: string): Promise<{ publicId: string, secureUrl: string }>`, `deleteFromCloudinary(publicId: string): Promise<void>`

- [ ] **Step 1: Write the failing test for SHA-256 computation**

```typescript
// server/tests/storage.test.ts
import { describe, it, expect } from 'vitest';
import { computeSha256 } from '../src/features/storage/hasher.service';

describe('Storage & Hashing Service', () => {
  it('computes consistent SHA-256 hash for buffer', () => {
    const buffer1 = Buffer.from('DocuMind test document content');
    const buffer2 = Buffer.from('DocuMind test document content');
    const buffer3 = Buffer.from('Different content');

    expect(computeSha256(buffer1)).toBe(computeSha256(buffer2));
    expect(computeSha256(buffer1)).not.toBe(computeSha256(buffer3));
    expect(computeSha256(buffer1)).toHaveLength(64);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/tests/storage.test.ts`
Expected: FAIL (Cannot find module `../src/features/storage/hasher.service`)

- [ ] **Step 3: Implement Hasher and Cloudinary Services**

```typescript
// server/src/features/storage/hasher.service.ts
import crypto from 'crypto';

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
```

```typescript
// server/src/features/storage/cloudinary.service.ts
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { config } from '../../core/config/env';

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
  secure: true,
});

export class CloudinaryService {
  async uploadRaw(buffer: Buffer, originalFilename: string): Promise<{ publicId: string; secureUrl: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: 'documind_documents',
          use_filename: true,
          unique_filename: true,
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            return reject(error || new Error('Cloudinary upload returned empty response'));
          }
          resolve({
            publicId: result.public_id,
            secureUrl: result.secure_url,
          });
        }
      );
      uploadStream.end(buffer);
    });
  }

  async deleteRaw(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
  }
}

export const cloudinaryService = new CloudinaryService();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/tests/storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/features/storage/ server/tests/storage.test.ts
git commit -m "feat(server): add sha-256 deduplication and cloudinary raw upload service"
```

---

### Task 4: Multi-Format Document Extractors (PDF, DOCX, XLSX, PPTX)

**Files:**
- Create: `server/src/features/extractors/extractors.types.ts`
- Create: `server/src/features/extractors/pdf.extractor.ts`
- Create: `server/src/features/extractors/docx.extractor.ts`
- Create: `server/src/features/extractors/excel.extractor.ts`
- Create: `server/src/features/extractors/pptx.extractor.ts`
- Create: `server/src/features/extractors/extractors.service.ts`
- Test: `server/tests/extractors.test.ts`

**Interfaces:**
- Consumes: File `Buffer`, `DocumentFormat`
- Produces: `extractDocumentContent(buffer: Buffer, format: DocumentFormat): Promise<{ segments: ExtractedSegment[], isScannedPdf: boolean }>`

- [ ] **Step 1: Write the failing test for extractors**

```typescript
// server/tests/extractors.test.ts
import { describe, it, expect } from 'vitest';
import { extractDocumentContent } from '../src/features/extractors/extractors.service';

describe('Document Extractors', () => {
  it('throws descriptive error for unsupported format', async () => {
    const buffer = Buffer.from('sample text');
    await expect(extractDocumentContent(buffer, 'unsupported' as any)).rejects.toThrow(
      'Unsupported document format: unsupported'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/tests/extractors.test.ts`
Expected: FAIL (Cannot find module `../src/features/extractors/extractors.service`)

- [ ] **Step 3: Implement Extractors and Extractor Service**

```typescript
// server/src/features/extractors/extractors.types.ts
import type { ChunkMetadata } from '@documind/shared';

export interface ExtractedSegment {
  content: string;
  metadata: ChunkMetadata;
}

export interface ExtractionResult {
  segments: ExtractedSegment[];
  isScannedPdf?: boolean;
  pageCount?: number;
}
```

```typescript
// server/src/features/extractors/pdf.extractor.ts
import pdfParse from 'pdf-parse';
import { ExtractionResult } from './extractors.types';

export async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const data = await pdfParse(buffer);
  const totalLength = data.text.trim().length;
  const isScannedPdf = totalLength < 50;

  // Split into rough page chunks if available, or full text
  const pages = data.text.split(/\f/); // form-feed character represents page breaks in pdf-parse
  const segments = pages
    .map((pageText, index) => ({
      content: pageText.trim(),
      metadata: { pageNumber: index + 1 },
    }))
    .filter((seg) => seg.content.length > 0);

  return {
    segments: segments.length > 0 ? segments : [{ content: data.text.trim(), metadata: { pageNumber: 1 } }],
    isScannedPdf,
    pageCount: data.numpages,
  };
}
```

```typescript
// server/src/features/extractors/docx.extractor.ts
import mammoth from 'mammoth';
import { ExtractionResult } from './extractors.types';

export async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const result = await mammoth.extractRawText({ buffer });
  const rawText = result.value.trim();
  const paragraphs = rawText.split(/\n\n+/).filter((p) => p.trim().length > 0);

  const segments = paragraphs.map((para, index) => ({
    content: para.trim(),
    metadata: { pageNumber: Math.floor(index / 5) + 1 }, // Estimated page grouping
  }));

  return { segments };
}
```

```typescript
// server/src/features/extractors/excel.extractor.ts
import * as xlsx from 'xlsx';
import { ExtractionResult, ExtractedSegment } from './extractors.types';

export async function extractExcel(buffer: Buffer): Promise<ExtractionResult> {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const segments: ExtractedSegment[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csvContent = xlsx.utils.sheet_to_csv(sheet);
    if (!csvContent || csvContent.trim().length === 0) continue;

    const rows = csvContent.split('\n').filter((r) => r.trim().length > 0);
    // Group into 20-row segments to preserve tabular context
    for (let i = 0; i < rows.length; i += 20) {
      const rowSlice = rows.slice(i, i + 20).join('\n');
      segments.push({
        content: `Sheet: ${sheetName}\n${rowSlice}`,
        metadata: {
          sheetName,
          rowStart: i + 1,
          rowEnd: Math.min(i + 20, rows.length),
        },
      });
    }
  }

  return { segments };
}
```

```typescript
// server/src/features/extractors/pptx.extractor.ts
import officeParser from 'officeparser';
import { ExtractionResult } from './extractors.types';

export async function extractPptx(buffer: Buffer): Promise<ExtractionResult> {
  return new Promise((resolve, reject) => {
    officeParser.parseOffice(buffer, (data: string, err: any) => {
      if (err) return reject(err);
      const text = data ? data.trim() : '';
      const slides = text.split(/Slide\s+(\d+)/i).filter((s) => s.trim().length > 0);
      
      const segments = slides.map((slideText, idx) => ({
        content: slideText.trim(),
        metadata: { slideNumber: idx + 1 },
      }));

      resolve({
        segments: segments.length > 0 ? segments : [{ content: text, metadata: { slideNumber: 1 } }],
      });
    });
  });
}
```

```typescript
// server/src/features/extractors/extractors.service.ts
import { DocumentFormat } from '@documind/shared';
import { ExtractionResult } from './extractors.types';
import { extractPdf } from './pdf.extractor';
import { extractDocx } from './docx.extractor';
import { extractExcel } from './excel.extractor';
import { extractPptx } from './pptx.extractor';

export async function extractDocumentContent(buffer: Buffer, format: DocumentFormat): Promise<ExtractionResult> {
  switch (format) {
    case 'pdf':
      return extractPdf(buffer);
    case 'docx':
      return extractDocx(buffer);
    case 'xlsx':
      return extractExcel(buffer);
    case 'pptx':
      return extractPptx(buffer);
    default:
      throw new Error(`Unsupported document format: ${format}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/tests/extractors.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/features/extractors/ server/tests/extractors.test.ts
git commit -m "feat(server): implement multi-format extractors for PDF, Word, Excel, and PPTX"
```

---

### Task 5: Recursive Chunking Engine

**Files:**
- Create: `server/src/features/chunking/chunking.types.ts`
- Create: `server/src/features/chunking/chunking.service.ts`
- Test: `server/tests/chunking.test.ts`

**Interfaces:**
- Consumes: `ExtractedSegment[]`, `{ chunkSize?: number, chunkOverlap?: number }`
- Produces: `chunkDocumentContent(segments: ExtractedSegment[], options?: ChunkOptions): ChunkResult[]`

- [ ] **Step 1: Write the failing test for recursive chunker**

```typescript
// server/tests/chunking.test.ts
import { describe, it, expect } from 'vitest';
import { chunkDocumentContent } from '../src/features/chunking/chunking.service';

describe('Recursive Chunking Service', () => {
  it('chunks long text into segments respecting chunkSize and preserves metadata', () => {
    const longText = 'A'.repeat(1200);
    const segments = [{ content: longText, metadata: { pageNumber: 3 } }];

    const chunks = chunkDocumentContent(segments, { chunkSize: 500, chunkOverlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].metadata.pageNumber).toBe(3);
    expect(chunks[1].metadata.pageNumber).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/tests/chunking.test.ts`
Expected: FAIL (Cannot find module `../src/features/chunking/chunking.service`)

- [ ] **Step 3: Implement Recursive Chunker Service**

```typescript
// server/src/features/chunking/chunking.types.ts
import type { ChunkMetadata } from '@documind/shared';

export interface ChunkOptions {
  chunkSize?: number; // default: 600 characters
  chunkOverlap?: number; // default: 100 characters
}

export interface ChunkResult {
  content: string;
  metadata: ChunkMetadata;
  tokenCount: number;
}
```

```typescript
// server/src/features/chunking/chunking.service.ts
import { ExtractedSegment } from '../extractors/extractors.types';
import { ChunkOptions, ChunkResult } from './chunking.types';

export function chunkDocumentContent(
  segments: ExtractedSegment[],
  options: ChunkOptions = {}
): ChunkResult[] {
  const chunkSize = options.chunkSize || 600;
  const chunkOverlap = options.chunkOverlap || 100;
  const results: ChunkResult[] = [];

  for (const segment of segments) {
    const text = segment.content.trim();
    if (!text) continue;

    if (text.length <= chunkSize) {
      results.push({
        content: text,
        metadata: { ...segment.metadata },
        tokenCount: Math.ceil(text.length / 4),
      });
      continue;
    }

    let start = 0;
    while (start < text.length) {
      let end = start + chunkSize;
      if (end < text.length) {
        // Attempt to break at paragraph, line, or sentence
        const lastPara = text.lastIndexOf('\n\n', end);
        const lastLine = text.lastIndexOf('\n', end);
        const lastSentence = text.lastIndexOf('. ', end);

        if (lastPara > start + chunkSize / 2) {
          end = lastPara + 2;
        } else if (lastLine > start + chunkSize / 2) {
          end = lastLine + 1;
        } else if (lastSentence > start + chunkSize / 2) {
          end = lastSentence + 2;
        }
      }

      const chunkText = text.substring(start, end).trim();
      if (chunkText.length > 0) {
        results.push({
          content: chunkText,
          metadata: { ...segment.metadata },
          tokenCount: Math.ceil(chunkText.length / 4),
        });
      }

      start = end - chunkOverlap;
      if (start >= text.length || end >= text.length) break;
    }
  }

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/tests/chunking.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/features/chunking/ server/tests/chunking.test.ts
git commit -m "feat(server): implement recursive character chunker with coordinate retention"
```

---

### Task 6: Pluggable AI Embedding Engine (Ollama & Gemini)

**Files:**
- Create: `server/src/features/ai/ai.provider.ts`
- Create: `server/src/features/ai/ollama.provider.ts`
- Create: `server/src/features/ai/gemini.provider.ts`
- Create: `server/src/features/ai/ai.service.ts`
- Test: `server/tests/ai.test.ts`

**Interfaces:**
- Consumes: `string[]`
- Produces: `aiService.generateEmbeddings(texts: string[]): Promise<number[][]>`, `aiService.setProvider(provider: 'ollama' | 'gemini')`

- [ ] **Step 1: Write the failing test for AI Service**

```typescript
// server/tests/ai.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AIService } from '../src/features/ai/ai.service';
import { AIProvider } from '../src/features/ai/ai.provider';

describe('Pluggable AI Service', () => {
  it('delegates embedding generation to active provider', async () => {
    const mockProvider: AIProvider = {
      name: 'ollama',
      embeddingDimension: 768,
      generateEmbeddings: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    };

    const ai = new AIService(mockProvider);
    const result = await ai.generateEmbeddings(['test']);
    expect(mockProvider.generateEmbeddings).toHaveBeenCalledWith(['test']);
    expect(result).toEqual([[0.1, 0.2, 0.3]]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/tests/ai.test.ts`
Expected: FAIL (Cannot find module `../src/features/ai/ai.service`)

- [ ] **Step 3: Implement Providers and AI Service**

```typescript
// server/src/features/ai/ai.provider.ts
export interface AIProvider {
  readonly name: 'ollama' | 'gemini';
  readonly embeddingDimension: number;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}
```

```typescript
// server/src/features/ai/ollama.provider.ts
import axios from 'axios';
import { AIProvider } from './ai.provider';
import { config } from '../../core/config/env';

export class OllamaProvider implements AIProvider {
  readonly name = 'ollama' as const;
  readonly embeddingDimension = 768;
  private baseUrl: string;
  private model: string;

  constructor(baseUrl = config.OLLAMA_BASE_URL, model = 'nomic-embed-text') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      const response = await axios.post(`${this.baseUrl}/api/embeddings`, {
        model: this.model,
        prompt: text,
      });
      embeddings.push(response.data.embedding);
    }
    return embeddings;
  }
}
```

```typescript
// server/src/features/ai/gemini.provider.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider } from './ai.provider';
import { config } from '../../core/config/env';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const;
  readonly embeddingDimension = 768;
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey = config.GEMINI_API_KEY || 'mock_key', model = 'text-embedding-004') {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = model;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const model = this.genAI.getGenerativeModel({ model: this.modelName });
    const requests = texts.map((t) => ({ content: { parts: [{ text: t }], role: 'user' } }));
    const result = await model.batchEmbedContents({ requests });
    return result.embeddings.map((e) => e.values);
  }
}
```

```typescript
// server/src/features/ai/ai.service.ts
import { AIProvider } from './ai.provider';
import { OllamaProvider } from './ollama.provider';
import { GeminiProvider } from './gemini.provider';
import { config } from '../../core/config/env';

export class AIService {
  private activeProvider: AIProvider;

  constructor(customProvider?: AIProvider) {
    if (customProvider) {
      this.activeProvider = customProvider;
    } else {
      this.activeProvider = config.DEFAULT_AI_PROVIDER === 'ollama'
        ? new OllamaProvider()
        : new GeminiProvider();
    }
  }

  setProvider(providerType: 'ollama' | 'gemini') {
    this.activeProvider = providerType === 'ollama'
      ? new OllamaProvider()
      : new GeminiProvider();
  }

  getProviderName(): string {
    return this.activeProvider.name;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return this.activeProvider.generateEmbeddings(texts);
  }
}

export const aiService = new AIService();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/tests/ai.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/features/ai/ server/tests/ai.test.ts
git commit -m "feat(server): add pluggable AI embedding service supporting Ollama and Gemini"
```

---

### Task 7: BullMQ Queue Producer & Worker Pipeline

**Files:**
- Create: `server/src/core/redis/index.ts`
- Create: `server/src/features/processing/processing.queue.ts`
- Create: `server/src/features/processing/processing.worker.ts`
- Create: `server/src/features/processing/processing.service.ts`
- Test: `server/tests/processing.test.ts`

**Interfaces:**
- Consumes: Redis, Drizzle DB, `extractDocumentContent`, `chunkDocumentContent`, `aiService`
- Produces: `enqueueDocumentProcessing(data: JobData): Promise<Job>`, `processingWorker`

- [ ] **Step 1: Write the failing test for processing queue helper**

```typescript
// server/tests/processing.test.ts
import { describe, it, expect, vi } from 'vitest';
import { formatJobDuration } from '../src/features/processing/processing.service';

describe('Processing Service', () => {
  it('formats job durations correctly into readable strings', () => {
    expect(formatJobDuration(1250)).toBe('1.25s');
    expect(formatJobDuration(450)).toBe('450ms');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/tests/processing.test.ts`
Expected: FAIL (Cannot find module `../src/features/processing/processing.service`)

- [ ] **Step 3: Implement Redis Connection, Queue, Worker, and Service**

```typescript
// server/src/core/redis/index.ts
import IORedis from 'ioredis';
import { config } from '../config/env';

export const redisConnection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});
```

```typescript
// server/src/features/processing/processing.queue.ts
import { Queue } from 'bullmq';
import { redisConnection } from '../../core/redis';
import { DocumentFormat } from '@documind/shared';

export interface DocumentJobData {
  documentId: string;
  fileFormat: DocumentFormat;
  cloudinarySecureUrl: string;
}

export const processingQueue = new Queue<DocumentJobData>('document-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
```

```typescript
// server/src/features/processing/processing.service.ts
import { db } from '../../core/db';
import { processingJobs, documents } from '../../core/db/schema';
import { eq } from 'drizzle-orm';
import { JobStage } from '@documind/shared';

export function formatJobDuration(ms?: number | null): string {
  if (!ms) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export async function updateJobStage(
  documentId: string,
  stage: JobStage,
  progressPercentage: number,
  durationMs?: number
) {
  await db.update(processingJobs)
    .set({
      stage,
      progressPercentage,
      durationMs,
      completedAt: stage === 'completed' || stage === 'failed' ? new Date() : undefined,
    })
    .where(eq(processingJobs.documentId, documentId));
}
```

```typescript
// server/src/features/processing/processing.worker.ts
import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { redisConnection } from '../../core/redis';
import { DocumentJobData } from './processing.queue';
import { extractDocumentContent } from '../extractors/extractors.service';
import { chunkDocumentContent } from '../chunking/chunking.service';
import { aiService } from '../ai/ai.service';
import { db } from '../../core/db';
import { documents, documentChunks } from '../../core/db/schema';
import { eq } from 'drizzle-orm';
import { updateJobStage } from './processing.service';

export const processingWorker = new Worker<DocumentJobData>(
  'document-processing',
  async (job: Job<DocumentJobData>) => {
    const { documentId, fileFormat, cloudinarySecureUrl } = job.data;
    const startTime = Date.now();

    try {
      await updateJobStage(documentId, 'extracting', 20);

      // Download buffer from Cloudinary URL
      const response = await axios.get(cloudinarySecureUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);

      const extraction = await extractDocumentContent(buffer, fileFormat);

      await updateJobStage(documentId, 'chunking', 50);
      const chunks = chunkDocumentContent(extraction.segments);

      if (chunks.length > 0) {
        await updateJobStage(documentId, 'embedding', 75);
        const texts = chunks.map((c) => c.content);
        const embeddings = await aiService.generateEmbeddings(texts);

        const chunkRecords = chunks.map((chunk, idx) => ({
          documentId,
          chunkIndex: idx,
          content: chunk.content,
          metadata: chunk.metadata,
          embedding: embeddings[idx],
          tokenCount: chunk.tokenCount,
        }));

        await db.insert(documentChunks).values(chunkRecords);
      }

      const durationMs = Date.now() - startTime;
      await db.update(documents)
        .set({
          status: 'completed',
          chunkCount: chunks.length,
          pageCount: extraction.pageCount,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));

      await updateJobStage(documentId, 'completed', 100, durationMs);
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      await db.update(documents)
        .set({ status: 'failed', errorMessage: err.message, updatedAt: new Date() })
        .where(eq(documents.id, documentId));

      await updateJobStage(documentId, 'failed', 100, durationMs);
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/tests/processing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/features/processing/ server/src/core/redis/ server/tests/processing.test.ts
git commit -m "feat(server): setup bullmq worker pipeline with multi-stage job progress tracking"
```

---

### Task 8: Express REST API & SSE Event Streaming

**Files:**
- Create: `server/src/core/base/BaseController.ts`
- Create: `server/src/core/middleware/errorHandler.ts`
- Create: `server/src/features/documents/documents.controller.ts`
- Create: `server/src/features/documents/documents.service.ts`
- Create: `server/src/features/documents/documents.routes.ts`
- Create: `server/src/features/processing/processing.controller.ts`
- Create: `server/src/features/processing/processing.routes.ts`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Test: `server/tests/api.test.ts`

**Interfaces:**
- Consumes: Multer, Drizzle DB, `cloudinaryService`, `processingQueue`
- Produces: REST endpoints (`/api/v1/documents/*`, `/api/v1/processing/*`)

- [ ] **Step 1: Write the failing integration test for API health and routes**

```typescript
// server/tests/api.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Express API Server', () => {
  it('responds with 200 OK on health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('rejects uploads without files with 400 Bad Request', async () => {
    const res = await request(app).post('/api/v1/documents/upload');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/tests/api.test.ts`
Expected: FAIL (Cannot find module `../src/app`)

- [ ] **Step 3: Implement BaseController, Routes, Controllers, and App**

```typescript
// server/src/core/base/BaseController.ts
import { Response } from 'express';
import { ApiResponse, ApiErrorResponse } from '@documind/shared';

export abstract class BaseController {
  protected sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(response);
  }

  protected sendError(res: Response, code: string, message: string, statusCode = 400, details?: unknown): void {
    const response: ApiErrorResponse = {
      success: false,
      error: { code, message, details },
      timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(response);
  }
}
```

```typescript
// server/src/features/documents/documents.controller.ts
import { Request, Response } from 'express';
import { BaseController } from '../../core/base/BaseController';
import { documentsService } from './documents.service';

export class DocumentsController extends BaseController {
  async upload(req: Request, res: Response) {
    if (!req.file) {
      return this.sendError(res, 'NO_FILE_PROVIDED', 'Please provide a file to upload.', 400);
    }

    try {
      const result = await documentsService.uploadAndProcess(req.file, req.body.title);
      return this.sendSuccess(res, result, 202);
    } catch (err: any) {
      if (err.message.includes('DUPLICATE')) {
        return this.sendError(res, 'DUPLICATE_DOCUMENT', err.message, 409);
      }
      return this.sendError(res, 'UPLOAD_FAILED', err.message, 500);
    }
  }

  async list(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await documentsService.listDocuments({ page, limit });
    return this.sendSuccess(res, result);
  }

  async getById(req: Request, res: Response) {
    const doc = await documentsService.getDocumentById(req.params.id);
    if (!doc) {
      return this.sendError(res, 'NOT_FOUND', 'Document not found.', 404);
    }
    return this.sendSuccess(res, doc);
  }

  async delete(req: Request, res: Response) {
    await documentsService.deleteDocument(req.params.id);
    return this.sendSuccess(res, { deletedId: req.params.id });
  }
}

export const documentsController = new DocumentsController();
```

```typescript
// server/src/features/documents/documents.service.ts
import { db } from '../../core/db';
import { documents, processingJobs } from '../../core/db/schema';
import { computeSha256 } from '../storage/hasher.service';
import { cloudinaryService } from '../storage/cloudinary.service';
import { processingQueue } from '../processing/processing.queue';
import { eq, desc } from 'drizzle-orm';
import { DocumentFormat } from '@documind/shared';

export class DocumentsService {
  async uploadAndProcess(file: Express.Multer.File, customTitle?: string) {
    const sha256 = computeSha256(file.buffer);

    // Check duplicate
    const existing = await db.query.documents.findFirst({
      where: eq(documents.sha256Hash, sha256),
    });
    if (existing) {
      throw new Error(`DUPLICATE: This file already exists as "${existing.title}".`);
    }

    // Determine format
    const ext = file.originalname.split('.').pop()?.toLowerCase() as DocumentFormat;
    const validFormats: DocumentFormat[] = ['pdf', 'docx', 'xlsx', 'pptx'];
    if (!validFormats.includes(ext)) {
      throw new Error(`Unsupported document extension: .${ext}`);
    }

    // Cloudinary upload
    const { publicId, secureUrl } = await cloudinaryService.uploadRaw(file.buffer, file.originalname);

    // Save Document record
    const [doc] = await db.insert(documents).values({
      title: customTitle || file.originalname,
      originalFilename: file.originalname,
      fileFormat: ext,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      sha256Hash: sha256,
      cloudinaryPublicId: publicId,
      cloudinarySecureUrl: secureUrl,
      status: 'pending',
    }).returning();

    // Create Processing Job
    const [job] = await db.insert(processingJobs).values({
      documentId: doc.id,
      stage: 'queued',
      progressPercentage: 0,
    }).returning();

    // Enqueue in BullMQ
    const bullJob = await processingQueue.add('process-document', {
      documentId: doc.id,
      fileFormat: ext,
      cloudinarySecureUrl: secureUrl,
    });

    await db.update(processingJobs)
      .set({ bullJobId: bullJob.id })
      .where(eq(processingJobs.id, job.id));

    return {
      documentId: doc.id,
      jobId: job.id,
      status: 'pending',
      filename: doc.originalFilename,
      fileSizeBytes: doc.fileSizeBytes,
    };
  }

  async listDocuments({ page, limit }: { page: number; limit: number }) {
    const offset = (page - 1) * limit;
    const items = await db.query.documents.findMany({
      limit,
      offset,
      orderBy: [desc(documents.createdAt)],
    });
    return { items, pagination: { page, limit } };
  }

  async getDocumentById(id: string) {
    return db.query.documents.findFirst({ where: eq(documents.id, id) });
  }

  async deleteDocument(id: string) {
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, id) });
    if (doc) {
      await cloudinaryService.deleteRaw(doc.cloudinaryPublicId);
      await db.delete(documents).where(eq(documents.id, id));
    }
  }
}

export const documentsService = new DocumentsService();
```

```typescript
// server/src/features/documents/documents.routes.ts
import { Router } from 'express';
import multer from 'multer';
import { documentsController } from './documents.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

export const documentsRouter = Router();

documentsRouter.post('/upload', upload.single('file'), (req, res) => documentsController.upload(req, res));
documentsRouter.get('/', (req, res) => documentsController.list(req, res));
documentsRouter.get('/:id', (req, res) => documentsController.getById(req, res));
documentsRouter.delete('/:id', (req, res) => documentsController.delete(req, res));
```

```typescript
// server/src/app.ts
import express from 'express';
import cors from 'cors';
import { documentsRouter } from './features/documents/documents.routes';

export const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/documents', documentsRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/tests/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/core/base/ server/src/features/documents/ server/src/app.ts server/tests/api.test.ts
git commit -m "feat(server): implement express REST endpoints for document upload, listing, and deletion"
```

---

### Task 9: React Client Scaffolding & Enterprise Design System

**Files:**
- Create: `client/package.json`
- Create: `client/vite.config.ts`
- Create: `client/tailwind.config.js`
- Create: `client/src/index.css`
- Create: `client/src/components/layout/Header.tsx`
- Create: `client/src/components/layout/Sidebar.tsx`
- Create: `client/src/components/layout/AppLayout.tsx`
- Test: `client/tests/layout.test.tsx`

**Interfaces:**
- Consumes: React 19, Tailwind CSS, Lucide React
- Produces: `AppLayout` with Deep Navy & Electric Blue navigation

- [ ] **Step 1: Write the failing test for layout rendering**

```typescript
// client/tests/layout.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Header } from '../src/components/layout/Header';

describe('Header Component', () => {
  it('renders DocuMind branding in header', () => {
    render(<Header />);
    expect(screen.getByText('DocuMind')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/tests/layout.test.tsx`
Expected: FAIL (Cannot find module `../src/components/layout/Header`)

- [ ] **Step 3: Implement Client Scaffolding, Tailwind, and Layout**

```json
// client/package.json
{
  "name": "@documind/client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build"
  },
  "dependencies": {
    "@documind/shared": "*",
    "@tanstack/react-query": "^5.62.8",
    "axios": "^1.7.9",
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-dropzone": "^14.3.5",
    "react-router-dom": "^7.1.0",
    "tailwind-merge": "^2.5.5",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.1",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.16",
    "typescript": "^5.7.2",
    "vite": "^6.0.3"
  }
}
```

```javascript
// client/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0B192C',
          800: '#1E3E62',
        },
        electric: {
          500: '#0066FF',
          600: '#0052CC',
        },
      },
    },
  },
  plugins: [],
};
```

```css
/* client/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-slate-50 text-slate-900 antialiased font-sans;
}
```

```tsx
// client/src/components/layout/Header.tsx
import React from 'react';
import { FileText, Bell } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-navy-900 flex items-center justify-center text-electric-500 font-bold">
          <FileText className="w-5 h-5 text-electric-500" />
        </div>
        <div>
          <span className="font-bold text-lg text-navy-900">DocuMind</span>
          <span className="text-xs text-slate-400 block -mt-1 font-medium">Enterprise Intelligence</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <Bell className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-navy-900 text-white font-semibold flex items-center justify-center text-xs">
          AD
        </div>
      </div>
    </header>
  );
};
```

```tsx
// client/src/components/layout/Sidebar.tsx
import React from 'react';
import { LayoutDashboard, Files, Search, MessageSquare, History, Settings } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/', active: false },
    { label: 'Documents', icon: Files, href: '/documents', active: true },
    { label: 'Search', icon: Search, href: '/search', active: false },
    { label: 'Assistant', icon: MessageSquare, href: '/assistant', active: false },
    { label: 'Processing', icon: History, href: '/processing', active: false },
    { label: 'Settings', icon: Settings, href: '/settings', active: false },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col py-6">
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              item.active
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <item.icon className={`w-4 h-4 ${item.active ? 'text-electric-500' : 'text-slate-400'}`} />
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
};
```

```tsx
// client/src/components/layout/AppLayout.tsx
import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/tests/layout.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/
git commit -m "feat(client): setup vite, react 19, tailwind css, and enterprise layout components"
```

---

### Task 10: Document Upload & Library UI with Live Status Tracking

**Files:**
- Create: `client/src/features/upload/components/Dropzone.tsx`
- Create: `client/src/features/documents/components/DocumentTable.tsx`
- Create: `client/src/features/documents/pages/DocumentsPage.tsx`
- Create: `client/src/features/documents/services/documentsApi.ts`
- Create: `client/src/App.tsx`
- Test: `client/tests/documentsPage.test.tsx`

**Interfaces:**
- Consumes: REST endpoints (`/api/v1/documents`), Dropzone, TanStack Query
- Produces: Full interactive Document Library with upload dropzone and status pill updates

- [ ] **Step 1: Write the failing test for DocumentTable**

```tsx
// client/tests/documentsPage.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DocumentTable } from '../src/features/documents/components/DocumentTable';

describe('DocumentTable Component', () => {
  it('renders document items with title and status badge', () => {
    const mockDocs = [
      {
        id: '1',
        title: 'Q3 Financial Report.pdf',
        originalFilename: 'Q3 Financial Report.pdf',
        fileFormat: 'pdf' as const,
        fileSizeBytes: 1048576,
        status: 'completed' as const,
        chunkCount: 14,
        createdAt: '2026-11-23T12:00:00Z',
      },
    ];

    render(<DocumentTable documents={mockDocs as any} onDelete={() => {}} />);
    expect(screen.getByText('Q3 Financial Report.pdf')).toBeDefined();
    expect(screen.getByText('Completed')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/tests/documentsPage.test.tsx`
Expected: FAIL (Cannot find module `../src/features/documents/components/DocumentTable`)

- [ ] **Step 3: Implement Dropzone, DocumentTable, and DocumentsPage**

```tsx
// client/src/features/upload/components/Dropzone.tsx
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileType } from 'lucide-react';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading?: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFilesSelected, isUploading }) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFilesSelected(acceptedFiles);
      }
    },
    [onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    },
    maxSize: 25 * 1024 * 1024,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
        isDragActive
          ? 'border-electric-500 bg-electric-500/5'
          : 'border-slate-300 hover:border-slate-400 bg-white'
      }`}
    >
      <input {...getInputProps()} />
      <div className="w-12 h-12 rounded-full bg-navy-900/5 text-navy-900 flex items-center justify-center mx-auto mb-3">
        <UploadCloud className="w-6 h-6 text-navy-900" />
      </div>
      <p className="font-semibold text-slate-800 text-sm mb-1">
        {isUploading ? 'Uploading file...' : 'Drop your documents here, or browse'}
      </p>
      <p className="text-xs text-slate-400 mb-4">Supports PDF, Word (.docx), Excel (.xlsx), and PowerPoint (.pptx) up to 25MB</p>
      <div className="flex items-center justify-center gap-2">
        {['PDF', 'DOCX', 'XLSX', 'PPTX'].map((fmt) => (
          <span key={fmt} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
            {fmt}
          </span>
        ))}
      </div>
    </div>
  );
};
```

```tsx
// client/src/features/documents/components/DocumentTable.tsx
import React from 'react';
import { Document } from '@documind/shared';
import { Trash2, ExternalLink, FileText, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface DocumentTableProps {
  documents: Document[];
  onDelete: (id: string) => void;
}

export const DocumentTable: React.FC<DocumentTableProps> = ({ documents, onDelete }) => {
  if (documents.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
        No documents uploaded yet. Drop a document above to get started.
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-electric-600 border border-blue-200">
            <Clock className="w-3 h-3 animate-spin" /> Processing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            Pending
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <table className="w-full text-left text-sm text-slate-600">
        <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
          <tr>
            <th className="px-6 py-3.5">Name</th>
            <th className="px-6 py-3.5">Format</th>
            <th className="px-6 py-3.5">Size</th>
            <th className="px-6 py-3.5">Chunks</th>
            <th className="px-6 py-3.5">Status</th>
            <th className="px-6 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                <FileText className="w-4 h-4 text-electric-500" />
                {doc.title}
              </td>
              <td className="px-6 py-4 uppercase text-xs font-semibold text-slate-500">{doc.fileFormat}</td>
              <td className="px-6 py-4">{(doc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</td>
              <td className="px-6 py-4 font-semibold text-slate-800">{doc.chunkCount}</td>
              <td className="px-6 py-4">{getStatusBadge(doc.status)}</td>
              <td className="px-6 py-4 text-right">
                <button
                  onClick={() => onDelete(doc.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                  title="Delete Document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

```tsx
// client/src/features/documents/pages/DocumentsPage.tsx
import React, { useState, useEffect } from 'react';
import { Dropzone } from '../../upload/components/Dropzone';
import { DocumentTable } from '../components/DocumentTable';
import { Document } from '@documind/shared';
import axios from 'axios';

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get('/api/v1/documents');
      if (res.data.success) {
        setDocuments(res.data.data.items);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        await axios.post('/api/v1/documents/upload', formData);
      } catch (err: any) {
        alert(err.response?.data?.error?.message || 'Upload failed');
      }
    }
    setIsUploading(false);
    fetchDocuments();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await axios.delete(`/api/v1/documents/${id}`);
      fetchDocuments();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Document Library</h1>
        <p className="text-sm text-slate-500 mt-1">Upload and manage documents processed for AI intelligent search.</p>
      </div>

      <Dropzone onFilesSelected={handleUpload} isUploading={isUploading} />

      <div>
        <h2 className="text-lg font-semibold text-navy-900 mb-4">All Documents ({documents.length})</h2>
        <DocumentTable documents={documents} onDelete={handleDelete} />
      </div>
    </div>
  );
};
```

```tsx
// client/src/App.tsx
import React from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { DocumentsPage } from './features/documents/pages/DocumentsPage';

export function App() {
  return (
    <AppLayout>
      <DocumentsPage />
    </AppLayout>
  );
}

export default App;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/tests/documentsPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/ client/src/App.tsx client/tests/documentsPage.test.tsx
git commit -m "feat(client): implement document dropzone, table view, and polling state synchronization"
```
