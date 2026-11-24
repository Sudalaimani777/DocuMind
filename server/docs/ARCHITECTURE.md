# Backend Architecture & Internal Subsystems — DocuMind

> **Package**: `server/`  
> **Architecture Pattern**: Layered Feature-Based Architecture + Asynchronous Worker Queue

---

## 1. Layered Architecture Overview

DocuMind Backend strictly isolates HTTP transport concerns from business logic, data persistence, and background queue workers:

```
┌────────────────────────────────────────────────────────┐
│                   HTTP / TRANSPORT LAYER               │
│   • Express Routers (routes/)                          │
│   • Middleware (helmet, cors, rate-limit, multer)      │
│   • Zod Schema Validation                              │
└───────────────────────────┬────────────────────────────┘
                            │ Delegates validated DTOs
┌───────────────────────────▼────────────────────────────┐
│                    CONTROLLER LAYER                    │
│   • Extract params, invoke service, format HTTP response
└───────────────────────────┬────────────────────────────┘
                            │ Calls business operations
┌───────────────────────────▼────────────────────────────┐
│                     SERVICE LAYER                      │
│   • DocumentService, DeduplicationService              │
│   • SearchService (RRF Hybrid Ranker)                  │
│   • RagService (Prompt engineering & token streaming)  │
│   • QueueService (BullMQ Producer)                     │
└─────────────┬──────────────────────────────┬───────────┘
              │ Enqueues job                 │ Database queries
┌─────────────▼─────────────┐   ┌────────────▼───────────┐
│      BULLMQ PRODUCER      │   │    DATA ACCESS LAYER   │
│   • 'document-processing' │   │   • Drizzle ORM Schema │
│   • Redis Connection Pool │   │   • pgvector Operators │
└─────────────┬─────────────┘   │   • Transactional Unit │
              │ Dispatches      └────────────────────────┘
┌─────────────▼─────────────┐
│    BULLMQ WORKER PROCESS  │
│   • Multi-Format Parsers  │
│   • Recursive Chunker     │
│   • AI Embedder (Ollama/  │
│     Gemini Adapters)      │
│   • Emits SSE Events      │
└───────────────────────────┘
```

---

## 2. Directory Structure (`server/src/`)

```
server/src/
├── config/                  # Environment variables & runtime settings
│   ├── env.ts               # Zod-validated environment config
│   ├── database.ts          # PostgreSQL pool & Drizzle ORM client
│   ├── redis.ts             # Redis connection for BullMQ & cache
│   └── cloudinary.ts        # Cloudinary SDK credentials & uploader
├── db/                      # Database models & migrations
│   ├── schema/              # Drizzle table definitions
│   │   ├── documents.ts
│   │   ├── chunks.ts
│   │   └── jobs.ts
│   └── migrations/          # Auto-generated SQL migration files
├── features/                # Domain-specific modules
│   ├── documents/           # Document metadata CRUD & deletion
│   ├── upload/              # Multer middleware, magic-bytes, SHA-256
│   ├── parsers/             # Multi-format extractors (PDF, DOCX, XLSX, PPTX)
│   ├── chunking/            # Recursive character chunker & coordinate tagger
│   ├── search/              # Full-text (tsvector), semantic (<=>), and RRF
│   ├── rag/                 # Retrieval-augmented generation & citation engine
│   └── jobs/                # BullMQ queue producer, worker, and SSE stream
├── ai/                      # Pluggable AI engine adapters
│   ├── ai.interface.ts      # EmbeddingProvider & ChatProvider contracts
│   ├── ollama.adapter.ts    # Local Ollama client (nomic-embed-text)
│   └── gemini.adapter.ts    # Cloud Gemini client (text-embedding-004)
├── middleware/              # Global Express middleware
│   ├── error-handler.ts     # Centralized AppError boundary
│   ├── rate-limiter.ts      # Endpoint rate limiters
│   └── validate.ts          # Zod request validation middleware
├── utils/                   # Shared helpers (logger, timing, string tools)
├── index.ts                 # Express application bootstrap & HTTP listener
└── worker.ts                # BullMQ standalone worker entry point
```

---

## 3. Asynchronous Job & Concurrency Model

### Express Event Loop Protection
Heavy tasks (file parsing, text chunking, and vector embedding) must **never execute synchronously** inside an Express HTTP request handler. 

1. **Producer (Express Request)**:
   * File upload completes into memory buffer.
   * SHA-256 hash verified.
   * Buffer streamed to Cloudinary.
   * Initial document record saved as `status: 'pending'`.
   * Job pushed to BullMQ Redis queue `document-processing`.
   * Express returns `202 Accepted` immediately.

2. **Consumer (BullMQ Worker)**:
   * Dedicated worker thread picks up job from Redis.
   * Executes multi-format parser matching `fileType`.
   * Splits text into 600-character chunks with coordinate tags.
   * Batches embedding generation using `p-limit(5)` to prevent 429 rate limits.
   * Batch-inserts chunks into `document_chunks` table in a single transaction.
   * Updates document record to `status: 'completed'`.
   * Emits progress events over Server-Sent Events (SSE).

---

## 4. Server-Sent Events (SSE) Manager

DocuMind uses a centralized `SSEManager` to stream real-time background progress to connected browsers without the overhead of WebSockets:

```typescript
export class SSEManager {
  private static clients: Map<string, Response[]> = new Map();

  static register(jobId: string, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const existing = this.clients.get(jobId) || [];
    this.clients.set(jobId, [...existing, res]);

    res.on('close', () => {
      this.unregister(jobId, res);
    });
  }

  static emit(jobId: string, event: string, data: unknown) {
    const targets = this.clients.get(jobId);
    if (!targets) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    targets.forEach((res) => res.write(payload));
  }

  private static unregister(jobId: string, res: Response) {
    const targets = this.clients.get(jobId) || [];
    this.clients.set(
      jobId,
      targets.filter((client) => client !== res)
    );
  }
}
```
