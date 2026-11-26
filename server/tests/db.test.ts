import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { parseConfig } from '../src/core/config/unifiedConfig.js';
import { vector768 } from '../src/core/db/types.js';
import {
  users,
  documents,
  documentChunks,
  processingJobs,
  chatSessions,
  chatMessages,
} from '../src/core/db/schema.js';
import { db, pool } from '../src/core/db/index.js';

describe('Milestone 1.2: Unified Config & Database Layer', () => {
  describe('unifiedConfig (parseConfig)', () => {
    it('parses valid environment configuration with PostgreSQL DATABASE_URL', () => {
      const cfg = parseConfig({
        NODE_ENV: 'test',
        PORT: '5001',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/documind',
        JWT_SECRET: 'super-secret-jwt-key-minimum-32-chars-long',
      });

      expect(cfg.server.port).toBe(5001);
      expect(cfg.server.nodeEnv).toBe('test');
      expect(cfg.database.url).toBe('postgresql://postgres:postgres@localhost:5432/documind');
    });

    it('rejects non-PostgreSQL DATABASE_URL values', () => {
      expect(() =>
        parseConfig({
          NODE_ENV: 'production',
          DATABASE_URL: 'mysql://localhost:3306/bad',
          JWT_SECRET: 'super-secret-jwt-key-minimum-32-chars-long',
        })
      ).toThrow();
    });
  });

  describe('vector768 custom Drizzle type', () => {
    const columnType = documentChunks.embedding;

    it('maps to PostgreSQL vector(768) SQL type', () => {
      expect(vector768).toBeDefined();
      expect(columnType.getSQLType()).toBe('vector(768)');
    });

    it('serializes a 768-dimension float array and deserializes string/array values', () => {
      const vec = Array.from({ length: 768 }, (_, i) => i * 0.001);
      const serialized = columnType.mapToDriverValue(vec);

      expect(typeof serialized).toBe('string');
      expect(serialized.startsWith('[')).toBe(true);
      expect(serialized.endsWith(']')).toBe(true);

      const parsedFromStr = columnType.mapFromDriverValue(serialized);
      expect(parsedFromStr).toHaveLength(768);
      expect(parsedFromStr[0]).toBe(0);
      expect(parsedFromStr[10]).toBeCloseTo(0.01, 6);

      const parsedFromArr = columnType.mapFromDriverValue(vec);
      expect(parsedFromArr).toEqual(vec);
    });

    it('rejects vectors whose dimension is not 768', () => {
      expect(() => columnType.mapToDriverValue([0.1, 0.2, 0.3])).toThrow(/768/);
    });
  });

  describe('Drizzle Schema Definitions', () => {
    it('defines users table with required columns and unique email', () => {
      const cfg = getTableConfig(users);
      expect(cfg.name).toBe('users');

      const colNames = cfg.columns.map((c) => c.name);
      expect(colNames).toEqual(
        expect.arrayContaining([
          'id',
          'name',
          'organization',
          'email',
          'password_hash',
          'created_at',
          'updated_at',
        ])
      );
      const emailCol = cfg.columns.find((c) => c.name === 'email');
      expect(emailCol?.isUnique).toBe(true);
    });

    it('defines documents table with user_id cascade FK, composite unique (user_id, sha256_hash), and indexes', () => {
      const cfg = getTableConfig(documents);
      expect(cfg.name).toBe('documents');

      const colNames = cfg.columns.map((c) => c.name);
      expect(colNames).toEqual(
        expect.arrayContaining([
          'id',
          'user_id',
          'title',
          'original_filename',
          'file_type',
          'file_size',
          'storage_url',
          'storage_public_id',
          'sha256_hash',
          'status',
          'chunk_count',
          'metadata',
          'created_at',
          'updated_at',
        ])
      );

      expect(cfg.foreignKeys.length).toBeGreaterThanOrEqual(1);
      expect(cfg.foreignKeys[0].onDelete).toBe('cascade');

      const uniqueNames = cfg.uniqueConstraints.map((u) => u.name);
      expect(uniqueNames).toContain('uq_user_document_sha256');

      const indexNames = cfg.indexes.map((i) => i.config.name);
      expect(indexNames).toEqual(
        expect.arrayContaining([
          'idx_documents_user_id',
          'idx_documents_status',
          'idx_documents_file_type',
        ])
      );
    });

    it('defines document_chunks table with vector(768), HNSW cosine index, and GIN FTS index', () => {
      const cfg = getTableConfig(documentChunks);
      expect(cfg.name).toBe('document_chunks');

      const embeddingCol = cfg.columns.find((c) => c.name === 'embedding');
      expect(embeddingCol?.getSQLType()).toBe('vector(768)');

      expect(cfg.foreignKeys.length).toBeGreaterThanOrEqual(1);
      expect(cfg.foreignKeys[0].onDelete).toBe('cascade');

      const indexNames = cfg.indexes.map((i) => i.config.name);
      expect(indexNames).toEqual(
        expect.arrayContaining([
          'idx_chunks_doc_id',
          'idx_chunks_embedding_hnsw',
          'idx_chunks_fts',
        ])
      );

      const hnswIdx = cfg.indexes.find((i) => i.config.name === 'idx_chunks_embedding_hnsw');
      const ginIdx = cfg.indexes.find((i) => i.config.name === 'idx_chunks_fts');
      expect(hnswIdx?.config.method).toBe('hnsw');
      expect(ginIdx?.config.method).toBe('gin');
    });

    it('defines processing_jobs table with document_id and user_id cascade FKs and indexes', () => {
      const cfg = getTableConfig(processingJobs);
      expect(cfg.name).toBe('processing_jobs');

      const colNames = cfg.columns.map((c) => c.name);
      expect(colNames).toEqual(
        expect.arrayContaining([
          'id',
          'document_id',
          'user_id',
          'status',
          'stage',
          'progress',
          'attempt_count',
          'error_log',
          'started_at',
          'completed_at',
          'created_at',
        ])
      );
      expect(cfg.foreignKeys).toHaveLength(2);
      expect(cfg.foreignKeys.every((fk) => fk.onDelete === 'cascade')).toBe(true);

      const indexNames = cfg.indexes.map((i) => i.config.name);
      expect(indexNames).toEqual(
        expect.arrayContaining([
          'idx_jobs_doc_id',
          'idx_jobs_user_id',
          'idx_jobs_status',
        ])
      );
    });

    it('defines chat_sessions table with user_id cascade FK, nullable document_id set null FK, title, timestamps, and composite index', () => {
      const cfg = getTableConfig(chatSessions);
      expect(cfg.name).toBe('chat_sessions');

      const colNames = cfg.columns.map((c) => c.name);
      expect(colNames).toEqual(
        expect.arrayContaining([
          'id',
          'user_id',
          'document_id',
          'title',
          'created_at',
          'updated_at',
        ])
      );

      expect(chatSessions.userId.name).toBe('user_id');
      expect(chatSessions.documentId.name).toBe('document_id');
      expect(chatSessions.documentId.notNull).toBe(false);
      expect(chatSessions.title.name).toBe('title');
      expect(chatSessions.createdAt.name).toBe('created_at');
      expect(chatSessions.updatedAt.name).toBe('updated_at');

      expect(cfg.foreignKeys).toHaveLength(2);
      const fkActions = cfg.foreignKeys.map((fk) => fk.onDelete);
      expect(fkActions).toEqual(expect.arrayContaining(['cascade', 'set null']));

      const indexNames = cfg.indexes.map((i) => i.config.name);
      expect(indexNames).toContain('idx_chat_sessions_user_id');

      const sessionUserIdx = cfg.indexes.find(
        (i) => i.config.name === 'idx_chat_sessions_user_id'
      );
      const indexedCols = sessionUserIdx?.config.columns ?? [];
      expect(indexedCols).toHaveLength(2);
      expect(indexedCols[0]).toMatchObject({ name: 'user_id' });
      expect(indexedCols[1]).toMatchObject({
        name: 'updated_at',
        indexConfig: { order: 'desc' },
      });
    });

    it('defines chat_messages table with session_id cascade FK, role, content, citations jsonb, created_at, and composite index', () => {
      const cfg = getTableConfig(chatMessages);
      expect(cfg.name).toBe('chat_messages');

      const colNames = cfg.columns.map((c) => c.name);
      expect(colNames).toEqual(
        expect.arrayContaining([
          'id',
          'session_id',
          'role',
          'content',
          'citations',
          'created_at',
        ])
      );

      expect(chatMessages.sessionId.name).toBe('session_id');
      expect(chatMessages.role.name).toBe('role');
      expect(chatMessages.content.name).toBe('content');
      expect(chatMessages.citations.name).toBe('citations');
      expect(chatMessages.createdAt.name).toBe('created_at');

      expect(cfg.foreignKeys).toHaveLength(1);
      expect(cfg.foreignKeys[0].onDelete).toBe('cascade');

      const indexNames = cfg.indexes.map((i) => i.config.name);
      expect(indexNames).toContain('idx_chat_messages_session_id');
    });
  });

  describe('Database Client Export', () => {
    it('initializes Drizzle db instance and pg Pool', () => {
      expect(db).toBeDefined();
      expect(pool).toBeDefined();
      expect(typeof db.select).toBe('function');
    });
  });
});
