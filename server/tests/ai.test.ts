import { describe, it, expect } from 'vitest';
import * as xlsx from 'xlsx';
import type { CoordinatesDTO } from '@documind/shared';
import { OllamaAdapter } from '../src/features/ai/ollama.adapter.js';
import { GeminiAdapter, type GeminiEmbeddingClient } from '../src/features/ai/gemini.adapter.js';
import { SseService, type ProcessingProgressEvent } from '../src/features/processing/sse.service.js';
import {
  DocumentIngestionProcessor,
  type IIngestionRepository,
  type NewChunkRecord,
} from '../src/features/processing/worker.js';
import type { AIProvider } from '../src/features/ai/ai.provider.js';

function make768Vector(seed = 0.01): number[] {
  return Array.from({ length: 768 }, (_, i) => Number(((i + 1) * seed).toFixed(6)));
}

class InMemoryIngestionRepository implements IIngestionRepository {
  public readonly jobUpdates: Array<{ jobId: string; status: string; stage: string; progress: number; errorLog?: string }> = [];
  public readonly docUpdates: Array<{ documentId: string; status: string; chunkCount?: number; metadata?: Record<string, unknown> }> = [];
  public readonly chunksByDoc = new Map<string, NewChunkRecord[]>();

  async updateJobState(
    jobId: string,
    update: {
      status: string;
      stage: string;
      progress: number;
      errorLog?: string | null;
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<void> {
    this.jobUpdates.push({
      jobId,
      status: update.status,
      stage: update.stage,
      progress: update.progress,
      ...(update.errorLog ? { errorLog: update.errorLog } : {}),
    });
  }

  async updateDocumentState(
    documentId: string,
    update: {
      status: string;
      chunkCount?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    this.docUpdates.push({
      documentId,
      ...update,
    });
  }

  async replaceDocumentChunks(
    documentId: string,
    chunks: NewChunkRecord[],
    metadata: Record<string, unknown>
  ): Promise<void> {
    this.chunksByDoc.set(documentId, chunks);
    this.docUpdates.push({
      documentId,
      status: 'completed',
      chunkCount: chunks.length,
      metadata,
    });
  }
}

describe('Milestone 1.7: Pluggable AI Adapters & BullMQ Worker Orchestrator', () => {
  describe('OllamaAdapter', () => {
    it('calls /api/embeddings with nomic-embed-text and validates 768 dimensions', async () => {
      const calls: Array<{ url: string; body: unknown }> = [];
      const fakeFetch: typeof fetch = async (input, init) => {
        calls.push({
          url: String(input),
          body: JSON.parse(String(init?.body ?? '{}')),
        });
        return new Response(JSON.stringify({ embedding: make768Vector(0.001) }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const adapter = new OllamaAdapter('http://localhost:11434', fakeFetch);
      const vectors = await adapter.generateBatchEmbeddings(['Chunk one', 'Chunk two']);

      expect(calls).toHaveLength(2);
      expect(calls[0].url).toBe('http://localhost:11434/api/embeddings');
      expect(calls[0].body).toEqual({ model: 'nomic-embed-text', prompt: 'Chunk one' });
      expect(vectors).toHaveLength(2);
      expect(vectors[0]).toHaveLength(768);
    });

    it('throws when Ollama returns wrong embedding dimensions or non-OK status', async () => {
      const badDimFetch: typeof fetch = async () =>
        new Response(JSON.stringify({ embedding: [0.1, 0.2] }), { status: 200 });

      const adapter = new OllamaAdapter('http://localhost:11434', badDimFetch);
      await expect(adapter.generateEmbedding('test')).rejects.toThrow(/768/);

      const failFetch: typeof fetch = async () =>
        new Response('Service Unavailable', { status: 503 });
      const failingAdapter = new OllamaAdapter('http://localhost:11434', failFetch);
      await expect(failingAdapter.generateEmbedding('test')).rejects.toThrow(/503/);
    });
  });

  describe('GeminiAdapter', () => {
    it('embeds text using gemini-embedding-001 with 768 outputDimensionality', async () => {
      const requests: unknown[] = [];
      const fakeClient: GeminiEmbeddingClient = {
        models: {
          async embedContent(params) {
            requests.push(params);
            return { embeddings: [{ values: make768Vector(0.002) }] };
          },
        },
      };

      const adapter = new GeminiAdapter('test-api-key', fakeClient);
      const vectors = await adapter.generateBatchEmbeddings(['Hello Gemini']);

      expect(requests).toHaveLength(1);
      expect(requests[0]).toEqual({
        model: 'gemini-embedding-001',
        contents: 'Hello Gemini',
        config: { outputDimensionality: 768 },
      });
      expect(vectors[0]).toHaveLength(768);
    });

    it('throws when GEMINI_API_KEY is missing', async () => {
      const adapter = new GeminiAdapter('');
      await expect(adapter.generateEmbedding('hello')).rejects.toThrow(/GEMINI_API_KEY/);
    });
  });

  describe('DocumentIngestionProcessor (Worker Pipeline)', () => {
    function buildSampleXlsx(): Buffer {
      const wb = xlsx.utils.book_new();
      const sheet = xlsx.utils.aoa_to_sheet([
        ['Department', 'Q3 Revenue', 'Notes'],
        ['Cloud', '12.4M', 'Strong enterprise expansion'],
        ['AI Search', '8.2M', 'pgvector adoption'],
      ]);
      xlsx.utils.book_append_sheet(wb, sheet, 'Financials');
      return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    }

    it('runs download -> extract -> chunk -> embed -> insert and emits SSE lifecycle events', async () => {
      const repo = new InMemoryIngestionRepository();
      const sse = new SseService();
      const events: ProcessingProgressEvent[] = [];
      sse.subscribe('user-1', (e) => events.push(e));

      const xlsxBuf = buildSampleXlsx();
      const fakeAi: AIProvider = {
        providerName: 'gemini',
        dimensions: 768,
        async generateEmbedding() {
          return make768Vector();
        },
        async generateBatchEmbeddings(texts) {
          return texts.map(() => make768Vector());
        },
      };

      const processor = new DocumentIngestionProcessor({
        repository: repo,
        aiProvider: fakeAi,
        sseService: sse,
        downloadBuffer: async () => xlsxBuf,
      });

      await processor.processJob({
        jobId: 'job-1',
        documentId: 'doc-1',
        userId: 'user-1',
        fileType: 'xlsx',
        storageUrl: 'https://res.cloudinary.com/demo/raw/upload/doc.xlsx',
      });

      const storedChunks = repo.chunksByDoc.get('doc-1');
      expect(storedChunks).toBeDefined();
      expect(storedChunks!.length).toBeGreaterThanOrEqual(1);
      expect(storedChunks![0].embedding).toHaveLength(768);
      expect((storedChunks![0].coordinates as CoordinatesDTO).sheetName).toBe('Financials');
      expect(events.map((e) => e.stage)).toEqual([
        'EXTRACTING',
        'CHUNKING',
        'EMBEDDING',
        'COMPLETED',
      ]);
    });

    it('handles scanned PDFs cleanly with chunkCount=0 and no empty embeddings', async () => {
      const repo = new InMemoryIngestionRepository();
      const sse = new SseService();
      let embedCalls = 0;

      const scannedPdf = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
          '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
          '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n' +
          'xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
          'trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF\n',
        'utf8'
      );

      const fakeAi: AIProvider = {
        providerName: 'ollama',
        dimensions: 768,
        async generateEmbedding() {
          embedCalls++;
          return make768Vector();
        },
        async generateBatchEmbeddings(texts) {
          embedCalls += texts.length;
          return texts.map(() => make768Vector());
        },
      };

      const processor = new DocumentIngestionProcessor({
        repository: repo,
        aiProvider: fakeAi,
        sseService: sse,
        downloadBuffer: async () => scannedPdf,
      });

      await processor.processJob({
        jobId: 'job-scan',
        documentId: 'doc-scan',
        userId: 'user-1',
        fileType: 'pdf',
        storageUrl: 'https://res.cloudinary.com/demo/raw/upload/scan.pdf',
      });

      expect(embedCalls).toBe(0);
      expect(repo.chunksByDoc.get('doc-scan')).toBeUndefined();
      const finalDoc = repo.docUpdates[repo.docUpdates.length - 1];
      expect(finalDoc.status).toBe('completed');
      expect(finalDoc.chunkCount).toBe(0);
      expect(finalDoc.metadata?.isScanned).toBe(true);
    });

    it('marks job and document failed and emits SSE FAILED when download or AI fails', async () => {
      const repo = new InMemoryIngestionRepository();
      const sse = new SseService();
      const events: ProcessingProgressEvent[] = [];
      sse.subscribe('user-1', (e) => events.push(e));

      const fakeAi: AIProvider = {
        providerName: 'gemini',
        dimensions: 768,
        async generateEmbedding() {
          throw new Error('Upstream timeout');
        },
        async generateBatchEmbeddings() {
          throw new Error('Upstream timeout');
        },
      };

      const processor = new DocumentIngestionProcessor({
        repository: repo,
        aiProvider: fakeAi,
        sseService: sse,
        downloadBuffer: async () => buildSampleXlsx(),
      });

      await expect(
        processor.processJob({
          jobId: 'job-err',
          documentId: 'doc-err',
          userId: 'user-1',
          fileType: 'xlsx',
          storageUrl: 'https://res.cloudinary.com/demo/raw/upload/err.xlsx',
        })
      ).rejects.toThrow(/Upstream timeout/);

      const lastJob = repo.jobUpdates[repo.jobUpdates.length - 1];
      expect(lastJob.status).toBe('failed');
      expect(lastJob.stage).toBe('FAILED');
      expect(lastJob.errorLog).toContain('Upstream timeout');
      expect(events[events.length - 1].stage).toBe('FAILED');
    });
  });
});
