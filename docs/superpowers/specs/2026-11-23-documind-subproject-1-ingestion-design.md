# Technical Design Document: DocuMind (Sub-Project 1: Foundation & Document Ingestion Pipeline)

- **Date:** 2026-11-23
- **Project:** DocuMind — AI-Powered Document Processing & Intelligent Search Platform
- **Sub-Project:** Sub-Project 1: Foundation, Infrastructure & Document Ingestion Pipeline
- **Status:** Draft / Pending Review

---

## 1. Executive Summary & Goals

DocuMind is an AI-powered document intelligence and search platform designed to ingest multi-format enterprise files, extract their contents with location coordinates, generate vector embeddings, and support intelligent hybrid retrieval and RAG question answering.

To ensure stability, rigorous testing, and incremental delivery, the overall system is decomposed into 4 milestones. This specification governs **Sub-Project 1: Foundation & Document Ingestion Pipeline**.

### Key Deliverables of Sub-Project 1
1. **Monorepo & Feature-Based Architecture**: React (Vite + TypeScript + Tailwind + shadcn/ui) frontend and Express (Node.js + TypeScript) backend structured as vertical feature slices with a shared typing package.
2. **Database & Vector Store**: PostgreSQL with `pgvector` extension configured and managed via Drizzle ORM.
3. **Secure Cloud Storage**: Direct-to-backend multipart upload with Cloudinary SDK storage, SHA-256 duplicate detection, and file validation.
4. **Asynchronous Background Processing Queue**: Redis and BullMQ job queue for reliable, non-blocking ingestion with automatic exponential backoff retries.
5. **Multi-Format Extraction Engine**: Native extractors for PDF (`.pdf`), Word (`.docx`, `.doc`), Excel (`.xlsx`, `.xls`), and PowerPoint (`.pptx`, `.ppt`) preserving page, slide, and sheet/row metadata.
6. **Chunking & Embedding Pipeline**: Recursive character chunker with token overlap and a pluggable `AIProvider` supporting both Local AI (Ollama `nomic-embed-text`) and Cloud AI (Google Gemini `text-embedding-004`) writing 768-dimensional embeddings to PostgreSQL `pgvector`.
7. **Frontend Ingestion UI**: Enterprise-grade UI (Deep Navy `#0B192C` / Electric Blue `#0066FF`), drag-and-drop multi-file upload, live processing queue with Server-Sent Events (SSE), document library table, and job retry controls.

---

## 2. System Architecture & Topology

### 2.1 Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│                      Client                            │
│  React 19 + TypeScript + Vite + Tailwind + shadcn/ui   │
│  (Zustand store, TanStack Query, React Hook Form)       │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / REST & SSE (status)
┌───────────────────────────▼────────────────────────────┐
│                   Express API Server                   │
│  • Zod Validation Middleware                           │
│  • Upload Controller (Multer memory buffer)            │
│  • SHA-256 Hasher & Cloudinary Upload Service          │
│  • BullMQ Queue Producer ('document-processing')       │
└─────────────┬──────────────────────────────┬───────────┘
              │ Enqueues job                 │ Reads/Writes metadata
┌─────────────▼─────────────┐   ┌────────────▼───────────┐
│     Redis (BullMQ)        │   │  PostgreSQL (pgvector) │
└─────────────┬─────────────┘   │  • documents           │
              │ Job dispatch    │  • document_chunks     │
┌─────────────▼─────────────┐   │    (vector embeddings) │
│   BullMQ Worker Process   │   │  • processing_jobs     │
│  • Multi-Format Extractors│───┤  • categories & tags   │
│    (PDF, DOCX, XLSX, PPTX)│   └────────────────────────┘
│  • Recursive Text Chunker │
│  • Pluggable AI Embedder  │
│    (Ollama / Gemini)      │
└───────────────────────────┘
```

### 2.2 Directory Layout (Feature-Based)

```
DocuMind/
├── package.json                    # Monorepo workspaces config
├── docker-compose.yml              # PostgreSQL (with pgvector) + Redis
├── shared/                         # Shared models, DTOs, and Zod schemas
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types.ts                # Document, Chunk, Job, AI types
│       └── schemas.ts              # Zod schemas for validation
├── server/                         # Express API & BullMQ Background Worker
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   └── src/
│       ├── core/                   # Cross-cutting infrastructure
│       │   ├── config/             # Zod-validated environment config
│       │   ├── db/                 # Drizzle client, migrations, schema.ts
│       │   ├── redis/              # Redis connection client
│       │   ├── middleware/         # errorHandler, validateRequest
│       │   └── base/               # BaseController.ts
│       ├── features/               # Vertical feature modules
│       │   ├── documents/          # Controller, service, routes, schema
│       │   ├── processing/         # Queue, worker, job tracker, routes
│       │   ├── extractors/         # pdf, docx, excel, pptx extractors
│       │   ├── chunking/           # recursiveChunker with coordinate retention
│       │   ├── ai/                 # AIProvider interface, Ollama & Gemini adapters
│       │   └── storage/            # Cloudinary uploader, SHA-256 hasher
│       ├── app.ts                  # Express app setup
│       └── index.ts                # Server bootstrapper & worker initialization
└── client/                         # React 19 + TypeScript + Vite SPA
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── core/                   # API client, config, formatting utils
        ├── components/
        │   ├── ui/                 # shadcn/ui components (button, dialog, table, badge)
        │   └── layout/             # Sidebar, Header, PageContainer
        ├── features/
        │   ├── documents/          # DocumentTable, DocumentFilter, MetaDrawer, useDocuments
        │   ├── upload/             # Dropzone, UploadProgressList, useFileUpload, uploadStore
        │   └── processing-history/ # JobTable, StatusBadge, JobTimelineDrawer, useProcessingJobs
        ├── routes/                 # App router
        └── App.tsx
```

---

## 3. Database Schema & Vector Modeling (Drizzle ORM)

### 3.1 PostgreSQL Extensions
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
```

### 3.2 Schema Definition (`server/src/core/db/schema.ts`)

```typescript
import { pgTable, uuid, text, timestamp, integer, jsonb, vector, index, uniqueIndex } from 'drizzle-orm/pg-core';

// 1. Documents Table
export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  originalFilename: text('original_filename').notNull(),
  fileFormat: text('file_format').notNull(), // 'pdf' | 'docx' | 'xlsx' | 'pptx'
  mimeType: text('mime_type').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  sha256Hash: text('sha256_hash').notNull(),
  
  // Cloudinary storage
  cloudinaryPublicId: text('cloudinary_public_id').notNull(),
  cloudinarySecureUrl: text('cloudinary_secure_url').notNull(),
  
  // Ingestion status
  status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage: text('error_message'),
  
  // Extracted metrics
  pageCount: integer('page_count'),
  chunkCount: integer('chunk_count').default(0),
  extractedMetadata: jsonb('extracted_metadata').$type<Record<string, unknown>>(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_documents_sha256').on(table.sha256Hash),
  index('idx_documents_status').on(table.status),
  index('idx_documents_created_at').on(table.createdAt),
]);

// 2. Document Chunks Table with Vector Embeddings
export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  
  // Source location coordinates for grounded citations
  metadata: jsonb('metadata').notNull().$type<{
    pageNumber?: number;
    slideNumber?: number;
    sheetName?: string;
    rowStart?: number;
    rowEnd?: number;
    columnRange?: string;
  }>(),
  
  // 768-dimension vector (compatible with nomic-embed-text & Gemini text-embedding-004)
  embedding: vector('embedding', { dimensions: 768 }),
  
  tokenCount: integer('token_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_chunks_document_id').on(table.documentId),
  index('idx_chunks_embedding').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);

// 3. Processing Jobs Table
export const processingJobs = pgTable('processing_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  bullJobId: text('bull_job_id'),
  stage: text('stage').notNull().default('queued'),
  // 'queued' | 'extracting' | 'chunking' | 'embedding' | 'completed' | 'failed'
  progressPercentage: integer('progress_percentage').default(0),
  attemptCount: integer('attempt_count').default(1),
  maxAttempts: integer('max_attempts').default(3),
  errorDetails: text('error_details'),
  durationMs: integer('duration_ms'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_processing_jobs_document_id').on(table.documentId),
  index('idx_processing_jobs_stage').on(table.stage),
]);

// 4. Categories & Tags
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

---

## 4. Ingestion Pipeline & Background Worker

### 4.1 Ingestion Flow
1. **Upload Request**: Express Multer parses multipart file into a memory buffer.
2. **Hash & Duplicate Check**: Calculate SHA-256 hash. If hash exists in `documents`, reject immediately with HTTP 409 Conflict (`DUPLICATE_DOCUMENT`) containing existing document metadata.
3. **Cloud Storage**: Upload buffer directly to Cloudinary via authenticated stream (`resource_type: 'raw'`). Obtain `public_id` and `secure_url`.
4. **Database Record Creation**: Insert new document row with `status: 'pending'`. Insert new processing job with `stage: 'queued'`.
5. **Enqueue Job**: Push job payload `{ documentId, fileFormat, cloudinarySecureUrl }` to BullMQ queue `document-processing`.
6. **Immediate Response**: Return HTTP 202 Accepted `{ documentId, jobId, status: 'pending' }`.
7. **Worker Processing**:
   - Fetch document and update job to `stage: 'extracting', progress: 20%`.
   - Dispatch to format extractor (`pdfExtractor`, `docxExtractor`, `excelExtractor`, or `pptxExtractor`).
   - Update job to `stage: 'chunking', progress: 50%`.
   - Run recursive character chunking (500-800 characters, 100 character overlap), preserving coordinate metadata.
   - Update job to `stage: 'embedding', progress: 75%`.
   - Batch embed chunk contents using the active `AIProvider` (Ollama or Gemini).
   - Batch insert rows into `document_chunks`.
   - Update `documents` status to `'completed'` and job to `'completed', progress: 100%`.
   - Emit progress event over Server-Sent Events (SSE).

### 4.2 Multi-Format Text Extractors (`server/src/features/extractors/`)

```typescript
export interface ExtractedSegment {
  content: string;
  metadata: {
    pageNumber?: number;
    slideNumber?: number;
    sheetName?: string;
    rowStart?: number;
    rowEnd?: number;
  };
}
```

* **PDF (`pdf.extractor.ts`)**: Uses `pdf-parse` / `pdfjs-dist` to parse page-by-page. Returns text per page with `{ pageNumber: i }`. Detects scanned PDFs if total character count is < 50 characters across all pages.
* **Word (`docx.extractor.ts`)**: Uses `mammoth.extractRawText` and table extractors to segment content by headings and paragraphs.
* **Excel (`excel.extractor.ts`)**: Uses `xlsx` to parse sheets, extracting tabular data converted into structured Markdown tables or key-value rows, tagged with `{ sheetName: sheet, rowStart, rowEnd }`.
* **PowerPoint (`pptx.extractor.ts`)**: Uses `officeparser` to parse slide text and speaker notes, tagged with `{ slideNumber: n }`.

### 4.3 Recursive Text Chunker (`server/src/features/chunking/chunking.service.ts`)
* Splits extracted segments into chunks of ~600 characters with 100 character overlap.
* Boundaries honor paragraph breaks (`\n\n`), newlines (`\n`), and sentence terminations (`. `).
* Chunks inherit the source metadata coordinates (`pageNumber`, `slideNumber`, `sheetName`) from their parent segment.

---

## 5. Pluggable AI Embedding Engine

### 5.1 Provider Abstraction
```typescript
export interface AIProvider {
  readonly name: 'ollama' | 'gemini';
  readonly embeddingDimension: number; // 768
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}
```

### 5.2 Implementations
1. **Local Provider (`OllamaProvider`)**:
   - Communicates with Ollama API: `POST http://localhost:11434/api/embeddings`.
   - Model: `nomic-embed-text` (768 dimensions).
2. **Cloud Provider (`GeminiProvider`)**:
   - Communicates with Google Gemini API via `@google/generative-ai`.
   - Model: `text-embedding-004` (768 dimensions).
   - Utilizes `batchEmbedContents` for high throughput.

### 5.3 Unified Vector Dimension (768)
Because both models produce 768 dimensions, the database column `vector('embedding', { dimensions: 768 })` requires no alterations when toggling between local and cloud providers.

---

## 6. API Specifications (REST + SSE)

### 6.1 Standard Response Envelopes
```typescript
// Standard Success
export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

// Standard Error
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

### 6.2 Endpoints

#### 1. Upload Document
* **Method**: `POST /api/v1/documents/upload`
* **Content-Type**: `multipart/form-data`
* **Body**: `file` (Binary file), `title` (optional string)
* **Response (202 Accepted)**:
```json
{
  "success": true,
  "data": {
    "documentId": "48b6c8aa-...",
    "jobId": "f78d10ee-...",
    "status": "pending",
    "filename": "annual_report.pdf",
    "fileSizeBytes": 2048576
  },
  "timestamp": "2026-11-23T12:00:00Z"
}
```

#### 2. List Documents
* **Method**: `GET /api/v1/documents`
* **Query Params**: `page` (default 1), `limit` (default 20), `status`, `format`, `search`
* **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "48b6c8aa-...",
        "title": "Annual Report",
        "originalFilename": "annual_report.pdf",
        "fileFormat": "pdf",
        "fileSizeBytes": 2048576,
        "status": "completed",
        "pageCount": 14,
        "chunkCount": 38,
        "createdAt": "2026-11-23T12:00:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  },
  "timestamp": "2026-11-23T12:00:00Z"
}
```

#### 3. Get Document Details
* **Method**: `GET /api/v1/documents/:id`
* **Response (200 OK)**: Full document row including extracted metadata and Cloudinary secure URL.

#### 4. Delete Document
* **Method**: `DELETE /api/v1/documents/:id`
* **Action**: Deletes asset from Cloudinary; cascades deletion of all chunks, embeddings, tags, and jobs from PostgreSQL.
* **Response (200 OK)**: `{ "success": true, "data": { "deletedId": "48b6c8aa-..." } }`

#### 5. List Processing Jobs
* **Method**: `GET /api/v1/processing/jobs`
* **Query Params**: `status`, `limit`
* **Response (200 OK)**: List of jobs with stages, durations, attempt counts, and error details.

#### 6. Retry Failed Job
* **Method**: `POST /api/v1/processing/jobs/:id/retry`
* **Response (200 OK)**: Re-queues the document into BullMQ, resets error state.

#### 7. Server-Sent Events (SSE)
* **Method**: `GET /api/v1/processing/events`
* **Action**: Streams real-time JSON events: `{ documentId, stage, progressPercentage, status }`.

---

## 7. Frontend User Experience (Enterprise Clean)

### 7.1 Design Tokens & Theming
* **Primary Deep Navy**: `#0B192C` (sidebar, primary buttons, headers)
* **Canvas Background**: `#F8FAFC` (subtle off-white slate)
* **Interactive Accent**: Electric Blue `#0066FF` (focus rings, active navigation, action links)
* **State Colors**: Completed `#10B981`, Processing `#0066FF`, Pending `#64748B`, Failed `#EF4444`.
* Strict exclusion of generic AI slop: no purple/violet mesh gradients, no arbitrary card glows.

### 7.2 UI Views
1. **Document Library Page (`/documents`)**:
   - Header with upload action and quick stats (Total Documents, Processed, In Queue).
   - Filter bar with search input, format pills (All, PDF, Word, Excel, PPT), and status dropdown.
   - Data table with sorting, format icons, file size, chunk count, status pill, and action menu (Download, View Chunks, Delete).
   - Empty state with clear dropzone CTA when no documents exist.
2. **Upload Modal / Dropzone Component**:
   - Drag-and-drop area with file type validation badges.
   - Immediate client-side SHA-256 calculation.
   - Upload progress bar per file and live status pill (*Uploading → Extracting → Embedding*).
3. **Processing History Drawer (`/processing-history`)**:
   - Detailed timeline per job with timestamps.
   - Error stack trace viewer for failed jobs with one-click "Retry" button.

---

## 8. Verification & Quality Assurance Plan

### 8.1 Automated Tests
* **Unit Tests (Vitest)**:
  - Extractor tests for sample PDF, DOCX, XLSX, PPTX files.
  - Chunker boundary and overlap tests.
  - SHA-256 duplicate calculation tests.
  - Provider mocking tests (Ollama & Gemini).
* **Integration Tests (Supertest)**:
  - `POST /api/v1/documents/upload` with valid and invalid file formats.
  - Duplicate upload rejection (HTTP 409).
  - Document deletion cascading tests (verifying chunk rows are deleted).
  - Processing job lifecycle state machine tests.

### 8.2 Manual Verification Checklist
- [ ] Run `docker compose up -d` to verify PostgreSQL (with `pgvector`) and Redis connect cleanly.
- [ ] Upload sample PDF, DOCX, XLSX, and PPTX documents via UI dropzone.
- [ ] Verify original file arrives in Cloudinary.
- [ ] Verify BullMQ worker processes job through *extracting -> chunking -> embedding -> completed*.
- [ ] Verify chunks and 768-dim embeddings exist in `document_chunks`.
- [ ] Try uploading the exact same file again to confirm SHA-256 duplicate warning.
- [ ] Test deleting a document and confirm all chunks/vectors in DB are purged.
