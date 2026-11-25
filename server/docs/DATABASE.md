# Database & Vector Store Specification — DocuMind Server

> **Database**: Supabase (Managed PostgreSQL 16+ with `pgvector`)  
> **ORM Layer**: Drizzle ORM  
> **Target Package**: `server/`

---

## 1. Supabase PostgreSQL & `pgvector` Initialization

Before running database migrations, enable the `vector` and `uuid-ossp` extensions in your Supabase project (via **Supabase Dashboard → Database → Extensions** or the **SQL Editor** on the default `postgres` database):

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify pgvector version (must be >= 0.7.0)
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
```

---

## 2. Complete Drizzle ORM Schema (`server/src/db/schema/`)

### 2.1 Schema Definition (`schema.ts`)
```typescript
import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  integer, 
  jsonb, 
  timestamp, 
  char, 
  customType, 
  index, 
  unique 
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

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
}, (table) => ({
  userSha256Unique: unique('uq_user_document_sha256').on(table.userId, table.sha256Hash),
  userIdIdx: index('idx_documents_user_id').on(table.userId),
  statusIdx: index('idx_documents_status').on(table.status),
  fileTypeIdx: index('idx_documents_file_type').on(table.fileType),
}));

export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  coordinates: jsonb('coordinates').notNull(),
  embedding: vector768('embedding').notNull(),
  tokenCount: integer('token_count').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  documentIdIdx: index('idx_chunks_doc_id').on(table.documentId),
  hnswVectorIdx: index('idx_chunks_hnsw').using(
    'hnsw',
    sql`${table.embedding} vector_cosine_ops WITH (m = 16, ef_construction = 64)`
  ),
  ftsGinIdx: index('idx_chunks_fts').using(
    'gin',
    sql`to_tsvector('english', ${table.content})`
  ),
}));

export const processingJobs = pgTable('processing_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 30 }).default('queued').notNull(),
  stage: varchar('stage', { length: 50 }).default('QUEUED').notNull(),
  progress: integer('progress').default(0).notNull(),
  attemptCount: integer('attempt_count').default(1).notNull(),
  errorLog: text('error_log'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  documentIdIdx: index('idx_jobs_doc_id').on(table.documentId),
  userIdIdx: index('idx_jobs_user_id').on(table.userId),
  statusIdx: index('idx_jobs_status').on(table.status),
}));

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_chat_sessions_user_id').on(table.userId),
}));

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  citations: jsonb('citations').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index('idx_chat_messages_session_id').on(table.sessionId),
}));

// Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  jobs: many(processingJobs),
  chatSessions: many(chatSessions),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  chunks: many(documentChunks),
  jobs: many(processingJobs),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  document: one(documents, {
    fields: [chatSessions.documentId],
    references: [documents.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));
```

---

## 3. Core Database Query Patterns

### 3.1 Vector Similarity Search Query (`<=>` Cosine Distance)
```typescript
import { sql } from 'drizzle-orm';
import { db } from '../config/database';
import { documentChunks, documents } from './schema';

export async function searchSemantic(queryVector: number[], limit = 10) {
  const vectorStr = JSON.stringify(queryVector);

  return db
    .select({
      chunkId: documentChunks.id,
      documentId: documentChunks.documentId,
      documentTitle: documents.title,
      fileType: documents.fileType,
      content: documentChunks.content,
      coordinates: documentChunks.coordinates,
      // 1 - cosine distance = cosine similarity
      similarity: sql<number>`1 - (${documentChunks.embedding} <=> ${vectorStr}::vector)`,
    })
    .from(documentChunks)
    .innerJoin(documents, sql`${documentChunks.documentId} = ${documents.id}`)
    .where(sql`${documents.status} = 'completed'`)
    .orderBy(sql`${documentChunks.embedding} <=> ${vectorStr}::vector`)
    .limit(limit);
}
```

### 3.2 Full-Text Search with Highlight Snippets
```typescript
export async function searchLexical(queryText: string, limit = 10) {
  return db
    .select({
      chunkId: documentChunks.id,
      documentId: documentChunks.documentId,
      documentTitle: documents.title,
      fileType: documents.fileType,
      coordinates: documentChunks.coordinates,
      content: documentChunks.content,
      rank: sql<number>`ts_rank(to_tsvector('english', ${documentChunks.content}), websearch_to_tsquery('english', ${queryText}))`,
      highlight: sql<string>`ts_headline('english', ${documentChunks.content}, websearch_to_tsquery('english', ${queryText}), 'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15')`,
    })
    .from(documentChunks)
    .innerJoin(documents, sql`${documentChunks.documentId} = ${documents.id}`)
    .where(
      sql`to_tsvector('english', ${documentChunks.content}) @@ websearch_to_tsquery('english', ${queryText})`
    )
    .orderBy(sql`ts_rank(to_tsvector('english', ${documentChunks.content}), websearch_to_tsquery('english', ${queryText})) DESC`)
    .limit(limit);
}
```

---

## 4. Migration & Schema Workflow

```bash
# 1. Generate SQL migration files from schema changes
npm run db:generate --workspace=server

# 2. Apply migrations to PostgreSQL
npm run db:migrate --workspace=server

# 3. Launch Drizzle Studio GUI for visual table inspection
npm run db:studio --workspace=server
```
