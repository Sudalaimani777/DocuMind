import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  char,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import type { CoordinatesDTO, CitationDTO, ChatRole } from '@documind/shared';
import { vector768 } from './types.js';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  organization: varchar('organization', { length: 150 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    fileType: varchar('file_type', { length: 20 }).notNull(),
    fileSize: integer('file_size').notNull(),
    storageUrl: text('storage_url').notNull(),
    storagePublicId: varchar('storage_public_id', { length: 255 }).notNull(),
    sha256Hash: char('sha256_hash', { length: 64 }).notNull(),
    status: varchar('status', { length: 30 }).default('pending').notNull(),
    chunkCount: integer('chunk_count').default(0).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_user_document_sha256').on(table.userId, table.sha256Hash),
    index('idx_documents_user_id').on(table.userId),
    index('idx_documents_status').on(table.status),
    index('idx_documents_file_type').on(table.fileType),
  ]
);

export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    coordinates: jsonb('coordinates').$type<CoordinatesDTO>().notNull(),
    embedding: vector768('embedding').notNull(),
    tokenCount: integer('token_count').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_chunks_doc_id').on(table.documentId),
    index('idx_chunks_embedding_hnsw')
      .using('hnsw', table.embedding.op('vector_cosine_ops'))
      .with({ m: 16, ef_construction: 64 }),
    index('idx_chunks_fts').using('gin', sql`to_tsvector('english', ${table.content})`),
  ]
);

export const processingJobs = pgTable(
  'processing_jobs',
  {
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
  },
  (table) => [
    index('idx_jobs_doc_id').on(table.documentId),
    index('idx_jobs_user_id').on(table.userId),
    index('idx_jobs_status').on(table.status),
  ]
);

export const chatSessions = pgTable(
  'chat_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').references(() => documents.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_chat_sessions_user_id').on(table.userId, table.updatedAt.desc())]
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).$type<ChatRole>().notNull(),
    content: text('content').notNull(),
    citations: jsonb('citations').$type<CitationDTO[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_chat_messages_session_id').on(table.sessionId, table.createdAt)]
);

export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  processingJobs: many(processingJobs),
  chatSessions: many(chatSessions),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  chunks: many(documentChunks),
  jobs: many(processingJobs),
  chatSessions: many(chatSessions),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}));

export const processingJobsRelations = relations(processingJobs, ({ one }) => ({
  document: one(documents, {
    fields: [processingJobs.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [processingJobs.userId],
    references: [users.id],
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
