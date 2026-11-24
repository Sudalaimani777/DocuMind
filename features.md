# DocuMind — Comprehensive Feature Specification

**Platform Name:** DocuMind  
**Tagline:** Intelligence Beyond Documents  
**Document Type:** Master Product Feature Catalog & Capabilities Specification  
**Version:** 1.0.0  

---

## Table of Contents
1. [Platform Overview & Philosophy](#1-platform-overview--philosophy)
2. [Module 0: User Authentication & Private Workspaces](#2-module-0-user-authentication--private-workspaces)
3. [Module A: Dashboard & Analytics](#3-module-a-dashboard--analytics)
4. [Module B: Document Management & Secure Storage](#4-module-b-document-management--secure-storage)
5. [Module C: Document Ingestion & Background Processing Engine](#5-module-c-document-ingestion--background-processing-engine)
6. [Module D: Multi-Format Content Extraction Engine](#6-module-d-multi-format-content-extraction-engine)
7. [Module E: Intelligent Multi-Mode Search Engine](#7-module-e-intelligent-multi-mode-search-engine)
8. [Module F: AI Document Assistant & Grounded RAG](#8-module-f-ai-document-assistant--grounded-rag)
9. [Module G: Chat History & Historical Sessions](#9-module-g-chat-history--historical-sessions)
10. [Module H: Processing History & Job Observability](#10-module-h-processing-history--job-observability)
11. [Module I: Pluggable AI Provider Architecture](#11-module-i-pluggable-ai-provider-architecture)
12. [Module J: System Settings & Administration](#12-module-j-system-settings--administration)
13. [Security, Integrity & Reliability Safeguards](#13-security-integrity--reliability-safeguards)
14. [Phase Delivery Roadmap](#14-phase-delivery-roadmap)

---

## 1. Platform Overview & Philosophy

DocuMind is an enterprise-grade document intelligence platform that transforms static, unstructured files into an interactive, fully searchable knowledge base. Rather than relying on simple keyword matching or detached AI summaries, DocuMind unifies **multi-format text extraction**, **asynchronous job processing**, **vector embeddings stored in PostgreSQL (`pgvector`)**, and **grounded Retrieval-Augmented Generation (RAG)** with precise source coordinate citations (page, slide, sheet, and row).

### Core Design Principles
* **Evidence-Grounded Intelligence:** AI responses must be strictly anchored to verified document excerpts. Hallucinations are barred; if content is absent, the system explicitly reports that the information cannot be found.
* **Deterministic Traceability:** Every chunk, embedding, and AI answer maintains strict coordinate metadata pointing back to the original document location.
* **Decoupled Asynchrony:** Heavy computational tasks (extraction, chunking, embedding generation) execute in background worker queues (BullMQ + Redis), ensuring UI responsiveness and zero request timeouts.
* **Zero AI Slop:** A disciplined, clean enterprise design system utilizing Swiss precision and flat material warmth (Pure White `#FFFFFF`, Charcoal `#222222`, 1px borders `#DDDDDD`, and Primary Coral `#FF385C`), eliminating generic AI design clichés, excessive gradients, and uninformative animations.

---

## 2. Module 0: User Authentication & Private Workspaces

The platform provides self-contained, native authentication with zero role complexity. Every registered user is an equal, standard user with a private, isolated document workspace.

### Functional Capabilities
1. **User Registration (Sign Up `/signup`)**:
   * Collects Full Name, Organization name, Work Email, and Password.
   * Enforces lowercase email uniqueness and password strength (minimum 8 characters).
   * Hashes passwords using `bcrypt` (10 rounds).
2. **User Authentication (Sign In `/signin`)**:
   * Authenticates credentials against the stored `bcrypt` hash.
   * Issues JWT Access Token (1 hour) and Refresh Token (7 days) delivered in `httpOnly`, `SameSite=Lax` cookies.
3. **Session Management & Sign Out (`/api/v1/auth/signout`)**:
   * Silent session restore on application load via `GET /api/v1/auth/me`.
   * Secure cookie clearing upon logout.
4. **Strict Document & Search Data Isolation**:
   * Every document record references `user_id` (`documents.user_id REFERENCES users(id)`).
   * Cryptographic SHA-256 deduplication is scoped per-user: `UNIQUE (user_id, sha256_hash)`.
   * Chunks, vector searches, RAG queries, and chat history sessions are strictly isolated to the authenticated user.

---

## 3. Module A: Dashboard & Analytics

The Dashboard serves as the central command center for the single administrator, presenting operational health metrics, document statistics, and system activity.

### Functional Capabilities
1. **Document Metrics Overview**:
   * Total documents uploaded across all time.
   * Successfully processed documents count.
   * Currently pending / in-progress processing jobs count.
   * Failed jobs count requiring attention or retry.
2. **Storage & Format Distribution**:
   * Breakdown of files by format: PDF, Word (DOCX/DOC), Excel (XLSX/XLS), PowerPoint (PPTX/PPT).
   * Total storage consumed in Cloudinary (in bytes, megabytes, or gigabytes).
   * Total chunks indexed and total vector count in PostgreSQL.
3. **Activity Feeds**:
   * Recent uploads feed with file name, uploader, format icon, and processing status pill.
   * Recent searches feed with query text, search mode (Keyword, Semantic, Hybrid), and timestamp.
4. **Quick Action Shortcuts**:
   * Direct "Upload Documents" action button launching the multi-file ingestion modal.
   * Direct search bar with keyboard shortcut (`Cmd/Ctrl + K`) to immediately initiate global document search.

---

## 3. Module B: Document Management & Secure Storage

The Document Management module provides comprehensive lifecycle management for raw files and their indexed representations.

### Functional Capabilities
1. **Multi-File Drag-and-Drop Ingestion**:
   * Unified dropzone supporting concurrent multi-file uploads.
   * Client-side format pre-validation (`.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, `.pptx`, `.ppt`).
   * Configurable file size limits (default: 25 MB per file).
   * Visual progress indicators displaying percentage, transfer speed, and current stage.
2. **SHA-256 Duplicate Detection**:
   * Computes the cryptographic SHA-256 hash before finalizing upload.
   * Rejects redundant uploads of identical files to prevent wasted processing cycles, vector storage, and Cloudinary storage costs.
   * Returns a friendly prompt alerting the user with a link to the existing document record.
3. **Secure Cloudinary Binary Storage**:
   * Streams raw file binaries securely through the backend Express API directly to Cloudinary (`resource_type: 'raw'`).
   * Stores the `cloudinary_public_id`, `cloudinary_secure_url`, file size in bytes, and MIME type in PostgreSQL.
   * Frontend never receives or handles Cloudinary API secrets.
4. **Document Library & Navigation**:
   * Filterable, sortable data table displaying original file name, title, format, size, chunk count, status badge, and creation date.
   * Full-text filtering across document titles and file names.
   * Quick action dropdown per document: View Details, Preview Raw File, Download File, View Chunks, and Delete Document.
5. **Cascading Document Deletion**:
   * Deleting a document calls the Cloudinary API to remove the remote binary asset.
   * Enforces PostgreSQL database cascading constraints (`ON DELETE CASCADE`), automatically purging all associated rows from `document_chunks`, `document_embeddings`, `processing_jobs`, and `document_tags` without orphan records.
6. **Categorization & Tagging**:
   * Tag assignment and custom category assignment for grouping documents by project, department, or topic.

---

## 4. Module C: Document Ingestion & Background Processing Engine

The ingestion pipeline handles asynchronous document processing via BullMQ job queues backed by Redis, decoupling file receipt from intensive extraction and vector computation.

### Ingestion Lifecycle Stages
1. **Queued**: Document record created in PostgreSQL (`status: 'pending'`); job enqueued in BullMQ (`document-processing` queue).
2. **Extracting**: Worker pulls the job, downloads/streams the binary, and dispatches it to the appropriate multi-format parser.
3. **Chunking**: Extracted text segments are split into deterministic chunks (500–800 characters) with token overlap (100 characters), preserving source coordinates.
4. **Embedding**: Text chunks are dispatched in batches to the configured AI provider (Ollama or Gemini) to generate 768-dimensional vector embeddings.
5. **Completed**: Chunks and embeddings are batch-inserted into PostgreSQL `document_chunks` using `pgvector`; document status transitions to `completed`.
6. **Failed**: Any extraction, timeout, or embedding failure transitions the document status to `failed`, captures the complete error message, and retains the job in Redis for retry.

### Reliability & Worker Features
* **Exponential Backoff**: Configured with 3 automatic retries with exponential backoff (5s, 10s, 20s) for transient external API or network interruptions.
* **Concurrency Throttling**: Worker concurrency is limited (default: 3 concurrent jobs) to prevent memory saturation or rate-limit violations against AI embedding APIs.
* **Server-Sent Events (SSE)**: Express delivers a live stream of job state updates to the React client (`/api/v1/processing/events`), enabling real-time progress bars without aggressive polling.

---

## 5. Module D: Multi-Format Content Extraction Engine

DocuMind includes dedicated extraction adapters for every supported file format, extracting both textual content and structural coordinates.

### Extractor Capabilities by Format
1. **Portable Document Format (PDF)**:
   * Engine: `pdf-parse` / `pdfjs-dist`.
   * Iterates through all document pages sequentially.
   * Retains `{ pageNumber: n }` for every text segment.
   * Scanned PDF Detection: Automatically counts character density; flags documents with under 50 characters across all pages as scanned PDFs for future OCR processing.
2. **Microsoft Word (`.docx`, `.doc`)**:
   * Engine: `mammoth`.
   * Preserves structural elements: headings (H1, H2, H3), paragraphs, bullet points, and tables.
   * Formats tables into structured Markdown text representations to maintain relational meaning for embeddings.
3. **Microsoft Excel (`.xlsx`, `.xls`)**:
   * Engine: `xlsx`.
   * Iterates through individual worksheets.
   * Extracts tabular rows and columns into clean Markdown tables or key-value tuples.
   * Retains `{ sheetName: string, rowStart: number, rowEnd: number, columnRange: string }`.
4. **Microsoft PowerPoint (`.pptx`, `.ppt`)**:
   * Engine: `officeparser`.
   * Extracts slide titles, slide body text, and presenter speaker notes.
   * Retains `{ slideNumber: number, hasNotes: boolean }`.

---

## 6. Module E: Intelligent Multi-Mode Search Engine

DocuMind provides three distinct search paradigms to satisfy different user intents:

```
┌────────────────────────────────────────────────────────┐
│               Intelligent Search Engine                │
├─────────────────────┬──────────────────┬───────────────┤
│   Keyword Search    │  Semantic Search │ Hybrid Search │
│  (PostgreSQL FTS)   │ (pgvector Cosine)│ (RRF Ranking) │
└─────────────────────┴──────────────────┴───────────────┘
```

### 1. Traditional Keyword Search (PostgreSQL Full-Text Search)
* Uses PostgreSQL `tsvector` and `tsquery` with GIN indexing.
* Matches exact words, word stems, and phrases across document titles and chunk text.
* Supports boolean operators (`AND`, `OR`, `NOT`).
* Generates highlighted snippet extracts (`ts_headline`) showing exact query matches in context.

### 2. Semantic Search (pgvector Vector Search)
* Converts user query into a 768-dimensional embedding via the active AI provider.
* Performs high-speed Cosine Distance (`<=>`) nearest neighbor queries using an HNSW index in PostgreSQL:
  ```sql
  SELECT chunk_id, content, metadata, 1 - (embedding <=> query_vector) AS similarity
  FROM document_chunks
  WHERE 1 - (embedding <=> query_vector) > 0.65
  ORDER BY embedding <=> query_vector ASC
  LIMIT 10;
  ```
* Ranks results by semantic conceptual meaning, even when exact keywords do not match.

### 3. Hybrid Search with Reciprocal Rank Fusion (RRF)
* Executes both keyword FTS and semantic vector queries in parallel.
* Fuses result rankings using Reciprocal Rank Fusion ($RRF = \sum \frac{1}{60 + rank}$), ensuring the search surface balances precision and semantic recall.

### 4. Faceted Filters & Metadata Refinement
* Narrow results by file type (`.pdf`, `.docx`, etc.).
* Date range filters (Uploaded in last 24h, 7 days, 30 days, or custom range).
* Category and Tag multi-select filters.
* Filter by specific document or search across the entire library.

---

## 8. Module F: AI Document Assistant & Grounded RAG

The AI Document Assistant provides an interactive conversational workspace for synthesizing and extracting insights from single or multiple documents.

### Key Capabilities
1. **Single-Document Deep Dive**:
   * Chat directly with an active document.
   * Ask targeted questions (e.g., *"What were the Q3 operating expenses?"*).
   * Context retrieval is pre-scoped to `document_id = target_doc_id`.
2. **Multi-Document Cross-Analysis**:
   * Query across the entire document corpus or a user-selected set of documents.
   * Synthesize themes across distinct files (e.g., *"Compare our 2024 and 2025 security policies"*).
3. **Grounded Retrieval & Verifiable Citations**:
   * Every factual claim in an answer is backed by an interactive citation badge `[Doc 1, p. 4]`.
   * Clicking a citation opens a reference drawer displaying the exact chunk excerpt and its source coordinates.
4. **Anti-Hallucination Guardrails**:
   * System prompt strictly mandates: *"Answer ONLY based on the provided document excerpts. If the context does not contain sufficient information to answer truthfully, state that the information is unavailable in the provided documents."*
   * Eliminates ungrounded speculation.
5. **Streaming Responses**:
   * Streams generation tokens over Server-Sent Events (SSE) for instantaneous, low-latency conversational feedback.

---

## 9. Module G: Chat History & Historical Sessions

A dedicated workspace (`/history`) providing complete persistence, inspection, and resumption of past RAG conversations.

### Functional Capabilities
1. **Session Persistence**:
   * Saves every conversation thread in PostgreSQL (`chat_sessions`), automatically deriving a concise title from the initial user prompt.
   * Scoped strictly to the authenticated `user_id`.
2. **Message & Citation History**:
   * Persists every user query and grounded assistant response along with structured citation metadata (`chat_messages`).
3. **Historical Catalog & Resumption**:
   * Filterable list of past conversations displaying session title, creation date, message count, and linked document (if single-document scoped).
   * One-click session resumption returning to `/chat` with full conversational context restored.
4. **Session Deletion**:
   * Allows users to delete individual chat sessions, cleanly cascading message records.

---

## 10. Module H: Processing History & Job Observability

A dedicated operational log module for monitoring background ingestion tasks.

### Functional Capabilities
1. **Job Table & Lifecycle Details**:
   * BullMQ Job ID, Document Name, Ingestion Stage, Progress Percentage, Duration in milliseconds, and Start/Finish timestamps.
2. **Error Diagnostic View**:
   * For failed jobs, displays complete failure reason, stack trace, and attempt count.
3. **One-Click Manual Retry**:
   * Instantly re-queues failed jobs into BullMQ without requiring the user to re-upload the original file.
4. **Purge & Cleanup Controls**:
   * Allows clearing completed job logs older than 30 days while retaining document metadata.

---

## 11. Module I: Pluggable AI Provider Architecture

DocuMind prevents vendor lock-in by providing a unified `AIProvider` contract allowing seamless transitions between Local AI and Cloud AI.

### Architectural Alignment
* **Standard Vector Dimension**: 768 dimensions.
* **Local Provider**:
  * Host: Ollama (`http://localhost:11434`)
  * Embeddings: `nomic-embed-text` (768 dimensions)
  * LLM: `llama3.1:8b` or `mistral:7b`
  * Zero external API costs, complete air-gapped privacy.
* **Cloud Provider**:
  * Host: Google Gemini API
  * Embeddings: `text-embedding-004` (768 dimensions)
  * LLM: `gemini-1.5-flash` or `gemini-1.5-pro`
  * High-speed batch processing, scalable cloud capacity.
* **Zero Schema Migration**: Because both local and cloud embeddings share the exact 768-dimension shape, toggling providers in settings requires **no database schema alterations**.

---

## 12. Module J: System Settings & Administration

A centralized administration view (`/settings`) for system configuration and observability.

### Functional Capabilities
1. **AI Configuration**:
   * Active Provider selector: `Local (Ollama)` vs `Cloud (Gemini)`.
   * Model selection dropdowns.
   * API Key input and connection test button for cloud providers.
   * Ollama Base URL input and health ping indicator for local providers.
2. **Processing Preferences**:
   * Default chunk size (characters / tokens).
   * Default chunk overlap (characters / tokens).
   * Ingestion concurrency settings.
3. **Storage Statistics**:
   * Cloudinary quota consumption and bandwidth usage.
   * PostgreSQL table size and vector index disk footprints.

---

## 13. Security, Integrity & Reliability Safeguards

1. **Input & MIME Validation**:
   * Inspects magic numbers / file signatures (preventing disguised executables or malicious files).
   * Strict Zod schema validation across all API query params, route parameters, and request bodies.
2. **Credential Isolation**:
   * All secrets (`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GEMINI_API_KEY`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`) reside in server environment variables.
   * Zero secrets or tokens are ever bundled or exposed in client builds.
3. **Prompt Injection & Context Isolation**:
   * Document chunks are treated strictly as untrusted data inputs within prompt templates.
   * System prompts use structural delimiters (`<document_context>...</document_context>`) to separate instructions from document text.
4. **Data Cascading & Relational Integrity**:
   * Foreign keys utilize `ON DELETE CASCADE`.
   * Composite constraint `UNIQUE(user_id, sha256_hash)` prevents duplicate file uploads per user.
5. **Graceful Error Handling**:
   * Standardized JSON error format (`{ success: false, error: { code, message, details } }`).
   * Express async error wrapping ensures no uncaught exceptions crash the process.

---

## 14. Phase Delivery Roadmap

To maintain engineering discipline and prevent unwieldy monolithic generation, DocuMind is organized into 4 sequential sub-projects:

* **Sub-Project 1: Foundation, User Authentication & Document Ingestion Pipeline** *(Current Scope)*
  * Monorepo workspaces (`shared/`, `server/`, `client/`) with shared types and Zod validation schemas.
  * Native User Authentication (`users` table, Organization profile field, `bcrypt` hashing, JWT in HTTP-only cookies, `requireAuth` middleware).
  * PostgreSQL + `pgvector` database setup with Drizzle ORM migrations and user-scoped data isolation.
  * Cloudinary integration, per-user SHA-256 duplicate detection, Redis + BullMQ worker queue.
  * Multi-format parsers (PDF, Word, Excel, PowerPoint) with source coordinate retention.
  * Recursive chunking & pluggable AI embedding engine (768-dim Ollama/Gemini).
  * Frontend document library, drag-and-drop upload queue, and processing progress integration.

* **Sub-Project 2: Search Repository Engine**
  * PostgreSQL Full-Text Search (keyword indexing & highlighted snippets).
  * Vector semantic search (`pgvector` cosine similarity with HNSW).
  * Hybrid search with Reciprocal Rank Fusion (RRF).
  * Filter bars (format, dates, categories, tags) and search repository screen (`/search`).

* **Sub-Project 3: Grounded RAG Assistant & Chat History**
  * Single-document and cross-document conversational chat (`/chat`).
  * Grounded answer generation with interactive citation badges linking to source coordinates.
  * Streaming responses (SSE).
  * Chat History screen (`/history`) with persistent `chat_sessions` and `chat_messages` in PostgreSQL.

* **Sub-Project 4: Scanned PDF OCR & Dashboard Analytics**
  * Scanned PDF detection and OCR text extraction.
  * Settings & Observability screen (`/settings`) with live provider switching and latency diagnostics.
  * Dashboard metrics, usage graphs, and end-to-end polish.
