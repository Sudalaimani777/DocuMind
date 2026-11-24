# Backend Server Requirements Specification — DocuMind

> **Package**: `server/`  
> **Runtime**: Node.js 20+ (TypeScript)  
> **Status**: Production Engineering Specification

---

## 1. Module Scope & Responsibilities

The `server/` package is the core computational engine of DocuMind. It owns:
1. **HTTP Routing & Ingestion**: Receiving multipart file uploads, validating magic-bytes, calculating SHA-256 hashes, and persisting binary assets to Cloudinary.
2. **Asynchronous Worker Pipelines**: Offloading heavy multi-format parsing (PDF, DOCX, XLSX, PPTX) and vector embedding generation to BullMQ workers backed by Redis.
3. **Database Access**: Managing relational metadata and executing vector similarity queries (`<=>`) via Drizzle ORM against PostgreSQL (`pgvector`).
4. **Intelligent Search Engine**: Executing Full-Text Search (`tsvector`) and vector search, fusing results via Reciprocal Rank Fusion (RRF).
5. **RAG Orchestration**: Constructing grounded prompts, querying AI providers (Ollama / Gemini), and streaming tokens and citations back to the client via Server-Sent Events (SSE).

---

## 2. Server Functional Requirements (SR)

### SR1: File Upload & Pre-Processing
* **SR1.1**: Enforce `multer.memoryStorage()` with a hard maximum file size limit of **25 MB** and maximum **5 files** per batch upload.
* **SR1.2**: Inspect binary magic numbers using `file-type` on in-memory buffers before any downstream processing. Reject mismatched or spoofed files with HTTP `400 Bad Request`.
* **SR1.3**: Calculate a binary `SHA-256` hash immediately upon buffer receipt. Query `documents` table for collisions. If found, abort upload immediately with HTTP `409 Conflict`.
* **SR1.4**: Stream verified files to Cloudinary using `v2.uploader.upload_stream` under resource type `raw`.
* **SR1.5**: Create a document record with `status: 'pending'`, enqueue a BullMQ job, and return HTTP `202 Accepted` in **<500ms**.

### SR2: Multi-Format Parsing & Coordinate Retention
* **SR2.1 (PDF)**: Extract text using `pdf-parse`, associating each text segment with its 1-based `pageNumber`. Detect zero-text pages to warn users of scanned/rasterized documents.
* **SR2.2 (Word)**: Extract `.docx` content using `mammoth`, preserving heading hierarchies (`H1`, `H2`, `H3`) and converting Word tables into structured Markdown tables.
* **SR2.3 (Excel)**: Parse `.xlsx` files using `xlsx`, iterating over all non-empty sheets, extracting rows into Markdown tables, and tagging coordinates with `sheetName` and `rowRange` (e.g. `Summary!A1:D20`).
* **SR2.4 (PowerPoint)**: Parse `.pptx` slides and presenter speaker notes using `pptx2json`, tagging coordinates with `slideNumber`.
* **SR2.5**: Maintain coordinate metadata integrity through chunking: every chunk must carry `{ pageNumber?, sheetName?, rowRange?, slideNumber? }`.

### SR3: Chunking & Pluggable Embedding
* **SR3.1**: Implement recursive character chunking (default: 600 characters, 100 character overlap, splitting on `\n\n`, `\n`, `. `, ` `).
* **SR3.2**: Support pluggable AI embedding generation standardized to **768 dimensions**:
  * **Local AI**: Ollama `nomic-embed-text`.
  * **Cloud AI**: Google Gemini `text-embedding-004`.
* **SR3.3**: Batch embedding calls using `p-limit(5)` to prevent network congestion or API rate limiting (HTTP 429).
* **SR3.4**: Batch-insert chunks and vector embeddings into PostgreSQL in a single database transaction.

### SR4: Search & Hybrid Ranking
* **SR4.1**: Execute lexical full-text queries using `to_tsvector('english', content) @@ websearch_to_tsquery('english', query)`.
* **SR4.2**: Execute semantic vector queries using `pgvector` cosine distance operator (`embedding <=> query_vector`).
* **SR4.3**: Fuse results using Reciprocal Rank Fusion: $RRF(d) = \sum \frac{1}{60 + rank(d)}$.
* **SR4.4**: Generate highlighted snippets using PostgreSQL `ts_headline`.

### SR5: RAG Engine & SSE Streaming
* **SR5.1**: Retrieve top 5 hybrid-ranked chunks matching the user's prompt.
* **SR5.2**: Inject strict anti-hallucination prompt boundaries mandating source citations in format `[Citation: DocName, Page X]`.
* **SR5.3**: Stream generated tokens and citation badges to client using `text/event-stream` (Server-Sent Events).

---

## 3. Server Non-Functional Requirements (SNFR)

* **SNFR1 (Zero Docker)**: All server processes must run directly via Node.js on the host OS connecting to local or managed PostgreSQL and Redis instances.
* **SNFR2 (Type Safety)**: 100% TypeScript with strict mode enabled. Zero use of `any`.
* **SNFR3 (Input Validation)**: 100% of incoming HTTP request parameters, query strings, and request bodies must be validated with Zod schemas.
* **SNFR4 (Fault Resiliency)**: BullMQ worker jobs must feature exponential backoff retry policies (5s, 10s, 20s). Failed jobs must log human-readable stack traces into `processing_jobs.error_log`.
* **SNFR5 (Security Headers)**: Apply `helmet` security middleware, `cors` origin whitelisting, and `express-rate-limit` guards.
