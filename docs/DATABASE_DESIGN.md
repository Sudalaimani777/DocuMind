# Database Design & Schema Specification — DocuMind

> **Database Engine**: Supabase (Managed PostgreSQL 16+)  
> **Extensions Required**: `pgvector` (vector cosine search), `uuid-ossp` (UUID generation)  
> **ORM Layer**: Drizzle ORM (TypeScript)

---

## 1. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ DOCUMENTS : "owns (cascades)"
    USERS ||--o{ CHAT_SESSIONS : "owns (cascades)"
    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : "has many (cascades)"
    DOCUMENTS ||--o{ PROCESSING_JOBS : "has many (cascades)"
    CHAT_SESSIONS ||--o{ CHAT_MESSAGES : "contains (cascades)"
    DOCUMENTS ||--o{ CHAT_SESSIONS : "scoped to (optional)"

    USERS {
        uuid id PK
        varchar name
        varchar organization
        varchar email UK
        text password_hash
        timestamp created_at
        timestamp updated_at
    }

    DOCUMENTS {
        uuid id PK
        uuid user_id FK
        varchar title
        varchar original_filename
        varchar file_type
        integer file_size
        varchar storage_url
        varchar storage_public_id
        varchar sha256_hash
        varchar status
        integer chunk_count
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }

    DOCUMENT_CHUNKS {
        uuid id PK
        uuid document_id FK
        integer chunk_index
        text content
        jsonb coordinates
        vector_768 embedding
        integer token_count
        timestamp created_at
    }

    PROCESSING_JOBS {
        uuid id PK
        uuid document_id FK
        uuid user_id FK
        varchar status
        varchar stage
        integer progress
        integer attempt_count
        text error_log
        timestamp started_at
        timestamp completed_at
        timestamp created_at
    }

    CHAT_SESSIONS {
        uuid id PK
        uuid user_id FK
        uuid document_id FK "optional"
        varchar title
        timestamp created_at
        timestamp updated_at
    }

    CHAT_MESSAGES {
        uuid id PK
        uuid session_id FK
        varchar role
        text content
        jsonb citations
        timestamp created_at
    }
```

---

## 2. Table Specifications

### 2.1 `users` Table
Stores registered enterprise user accounts.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique user identifier. |
| `name` | `VARCHAR(100)` | `NOT NULL` | Full display name. |
| `organization` | `VARCHAR(150)` | `NOT NULL` | Company or institution name. |
| `email` | `VARCHAR(255)` | `UNIQUE`, `NOT NULL` | Primary email (stored lowercased). |
| `password_hash` | `TEXT` | `NOT NULL` | Secure password hash generated via `bcrypt` (10 rounds). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `NOW()` | Registration timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `NOW()` | Profile update timestamp. |

---

### 2.2 `documents` Table
Stores root document metadata and upload tracking, scoped strictly to the owning user.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique document identifier. |
| `user_id` | `UUID` | `NOT NULL`, `REFERENCES users(id) ON DELETE CASCADE` | Owner user identifier. |
| `title` | `VARCHAR(255)` | `NOT NULL` | Display title of document. |
| `original_filename` | `VARCHAR(255)` | `NOT NULL` | Sanitized original filename. |
| `file_type` | `VARCHAR(20)` | `NOT NULL` | Format: `'pdf'`, `'docx'`, `'xlsx'`, `'pptx'`. |
| `file_size` | `INTEGER` | `NOT NULL` | File size in bytes. |
| `storage_url` | `TEXT` | `NOT NULL` | Cloudinary raw secure download URL. |
| `storage_public_id` | `VARCHAR(255)` | `NOT NULL` | Cloudinary public ID for deletion. |
| `sha256_hash` | `CHAR(64)` | `NOT NULL` | Binary hash for cryptographic deduplication. |
| `status` | `VARCHAR(30)` | `NOT NULL`, Default `'pending'` | Ingestion status: `'pending'`, `'processing'`, `'completed'`, `'failed'`. |
| `chunk_count` | `INTEGER` | `NOT NULL`, Default `0` | Total number of generated vector chunks. |
| `metadata` | `JSONB` | Default `'{}'::jsonb` | Extracted properties (page count, sheet names, author). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `NOW()` | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `NOW()` | Last modification timestamp. |

*Table Constraint*: `CONSTRAINT uq_user_document_sha256 UNIQUE (user_id, sha256_hash)`

---

### 2.3 `document_chunks` Table
Stores parsed text segments, structural coordinates, and 768-dim vector embeddings.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique chunk identifier. |
| `document_id` | `UUID` | `NOT NULL`, `REFERENCES documents(id) ON DELETE CASCADE` | Parent document foreign key (cascading). |
| `chunk_index` | `INTEGER` | `NOT NULL` | 0-based sequential order in document. |
| `content` | `TEXT` | `NOT NULL` | Raw text payload of chunk (600 chars). |
| `coordinates` | `JSONB` | `NOT NULL` | Structural location: `{ pageNumber?: number, sheetName?: string, rowRange?: string, slideNumber?: number }`. |
| `embedding` | `vector(768)` | `NOT NULL` | 768-dimensional vector embedding. |
| `token_count` | `INTEGER` | `NOT NULL` | Estimated token length of content. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `NOW()` | Insertion timestamp. |

---

### 2.4 `processing_jobs` Table
Maintains BullMQ background worker state and observability logs.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique job execution ID. |
| `document_id` | `UUID` | `NOT NULL`, `REFERENCES documents(id) ON DELETE CASCADE` | Target document foreign key. |
| `user_id` | `UUID` | `NOT NULL`, `REFERENCES users(id) ON DELETE CASCADE` | Job owner user identifier. |
| `status` | `VARCHAR(30)` | `NOT NULL`, Default `'queued'` | `'queued'`, `'active'`, `'completed'`, `'failed'`. |
| `stage` | `VARCHAR(50)` | `NOT NULL`, Default `'QUEUED'` | `'EXTRACTING'`, `'CHUNKING'`, `'EMBEDDING'`, `'COMPLETED'`. |
| `progress` | `INTEGER` | `NOT NULL`, Default `0` | Percentage completion (0 to 100). |
| `attempt_count` | `INTEGER` | `NOT NULL`, Default `1` | Number of execution retries. |
| `error_log` | `TEXT` | `NULL` | Detailed stack trace/reason if failed. |
| `started_at` | `TIMESTAMPTZ` | `NULL` | Timestamp worker picked up job. |
| `completed_at` | `TIMESTAMPTZ` | `NULL` | Timestamp job finished or aborted. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `NOW()` | Enqueue timestamp. |

---

### 2.5 `chat_sessions` Table
Stores conversational RAG chat threads for the Chat History (`/history`) interface.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique chat session ID. |
| `user_id` | `UUID` | `NOT NULL`, `REFERENCES users(id) ON DELETE CASCADE` | Session owner user identifier. |
| `document_id` | `UUID` | `NULL`, `REFERENCES documents(id) ON DELETE SET NULL` | Target document (if single-doc scoped; NULL if corpus-wide). |
| `title` | `VARCHAR(255)` | `NOT NULL` | Session title (auto-generated from first prompt or user edited). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `NOW()` | Session creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `NOW()` | Last message timestamp. |

---

### 2.6 `chat_messages` Table
Stores individual user queries and grounded assistant answers with structured citation coordinate badges.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique message ID. |
| `session_id` | `UUID` | `NOT NULL`, `REFERENCES chat_sessions(id) ON DELETE CASCADE` | Parent session foreign key. |
| `role` | `VARCHAR(20)` | `NOT NULL` | Message author: `'user'` or `'assistant'`. |
| `content` | `TEXT` | `NOT NULL` | Verbatim text content. |
| `citations` | `JSONB` | Default `'[]'::jsonb` | Array of citation pills: `[{ documentId, title, coordinates, excerpt }]`. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `NOW()` | Message creation timestamp. |

---

## 3. High-Performance Indexing Strategy

```sql
-- 1. Deduplication Per-User Index
CREATE UNIQUE INDEX idx_documents_user_sha256 ON documents(user_id, sha256_hash);

-- 2. User Document Listing & Filters
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_file_type ON documents(file_type);

-- 3. Chunk Foreign Key Index
CREATE INDEX idx_document_chunks_doc_id ON document_chunks(document_id);

-- 4. Full-Text Search GIN Index (Lexical Search)
CREATE INDEX idx_chunks_fts ON document_chunks USING gin(to_tsvector('english', content));

-- 5. HNSW Vector Index (Semantic Cosine Similarity Search)
-- Uses vector_cosine_ops for cosine distance (<=>)
CREATE INDEX idx_chunks_embedding_hnsw ON document_chunks 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- 6. Chat History Indexes
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
```

### Why HNSW over IVFFlat?
* **Zero Training Requirement**: IVFFlat requires prior clustering training on thousands of vectors and degrades as data grows.
* **Superior Recall**: HNSW (Hierarchical Navigable Small World) graph indexing delivers **98%+ recall** even under high query concurrency with sub-10ms lookup latencies.

---

## 4. Drizzle ORM Schema Implementation

```typescript
import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, char, unique, customType } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Custom pgvector type for 768 dimensions
export const vector768 = customType<{ data: number[] }>({
  dataType() {
    return 'vector(768)';
  },
  toDriver(value: number[]) {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown) {
    return typeof value === 'string' ? JSON.parse(value) : (value as number[]);
  },
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  organization: varchar('organization', { length: 150 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 20 }).notNull(),
  fileSize: integer('file_size').notNull(),
  storageUrl: text('storage_url').notNull(),
  storagePublicId: varchar('storage_public_id', { length: 255 }).notNull(),
  sha256Hash: char('sha256_hash', { length: 64 }).notNull(),
  status: varchar('status', { length: 30 }).default('pending').notNull(),
  chunkCount: integer('chunk_count').default(0).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userSha256Unique: unique('uq_user_document_sha256').on(t.userId, t.sha256Hash),
}));

export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  coordinates: jsonb('coordinates').notNull(),
  embedding: vector768('embedding').notNull(),
  tokenCount: integer('token_count').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const processingJobs = pgTable('processing_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 30 }).default('queued').notNull(),
  stage: varchar('stage', { length: 50 }).default('QUEUED').notNull(),
  progress: integer('progress').default(0).notNull(),
  attemptCount: integer('attempt_count').default(1).notNull(),
  errorLog: text('error_log'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  citations: jsonb('citations').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```
