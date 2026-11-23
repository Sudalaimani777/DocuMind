# Project Proposal: DocuMind
## AI-Powered Document Processing & Intelligent Search Platform

**Prepared by:** Sudalaimani Kannan  
**Date:** November 23, 2026  
**Document Purpose:** Architecture, Tech Stack, and Functional Specification for Mentor Review & Sign-off  

---

## 1. Executive Summary & Problem Statement

### The Problem
Organizations and individuals accumulate large volumes of unstructured and semi-structured documents (PDFs, Word documents, Excel spreadsheets, PowerPoint presentations). Traditional document management tools suffer from critical shortcomings:
* **Keyword Search Blindness**: Keyword search only finds exact string matches. It fails to grasp conceptual meaning, synonyms, or contextual intent.
* **Loss of Structural Context**: Tabular data in Excel, bulleted hierarchies in Word, and presenter notes in PowerPoint lose their relational context when dumped into plain text.
* **Lack of Grounded Synthesis**: Standard search tools return entire documents, forcing users to read dozens of pages to answer a simple question. Meanwhile, generic AI tools hallucinate details because they lack verifiable citations back to the source document.

### The Solution: DocuMind
**DocuMind ("Intelligence Beyond Documents")** is a centralized platform that automatically extracts multi-format documents, generates vector embeddings, and enables:
1. **Keyword, Semantic & Hybrid Search** with relevance scoring and highlighted snippets.
2. **Grounded RAG (Retrieval-Augmented Generation) Q&A** with verifiable citations pointing directly to the exact page, slide, sheet, or row.
3. **Document Comparison** with structural diffing and AI-generated comparative summaries.
4. **Asynchronous Background Ingestion** using Redis and BullMQ to guarantee high throughput and zero request timeouts.

---

## 2. System Architecture & Topology

DocuMind uses a **feature-based decoupled architecture** ensuring separation of concerns between user-facing HTTP requests, asynchronous background extraction workers, persistent storage, and AI inference.

```
┌────────────────────────────────────────────────────────┐
│                   Frontend Client                      │
│     React 19 · TypeScript · Vite · Tailwind CSS        │
│          shadcn/ui · Zustand · TanStack Query          │
└───────────────────────────┬────────────────────────────┘
                            │ REST APIs & Server-Sent Events (SSE)
┌───────────────────────────▼────────────────────────────┐
│                  Express Backend API                   │
│   • Zod Input Validation & Error Boundaries            │
│   • Multer Upload Controller (Memory Buffer)           │
│   • SHA-256 Deduplication Service                      │
│   • Cloudinary Streaming Service                       │
│   • BullMQ Queue Producer ('document-processing')      │
└─────────────┬──────────────────────────────┬───────────┘
              │ Enqueues job                 │ Reads/Writes metadata
┌─────────────▼─────────────┐   ┌────────────▼───────────┐
│     Redis (BullMQ)        │   │  PostgreSQL (pgvector) │
└─────────────┬─────────────┘   │  • documents           │
              │ Job dispatch    │  • document_chunks     │
┌─────────────▼─────────────┐   │    (vector embeddings) │
│   BullMQ Worker Process   │   │  • processing_jobs     │
│  • Multi-Format Parsers   │───┤  • categories & tags   │
│    (PDF, DOCX, XLSX, PPTX)│   └────────────────────────┘
│  • Recursive Chunker      │
│  • Pluggable AI Embedder  │
│    (Ollama / Gemini)      │
└───────────────────────────┘
```

---

## 3. Technology Stack & Technical Justifications

| Layer | Chosen Technology | Why This Specific Technology? (Mentor Justification) |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19 + TypeScript + Vite** | Blazing-fast development server (HMR), strong type safety, and standard industry adoption. |
| **Styling & UI Components** | **Tailwind CSS + shadcn/ui** | Copy-paste accessible components (Radix primitives) with complete style control. Allows implementing a clean enterprise theme (Deep Navy & Electric Blue) without generic "AI template" styles. |
| **State Management** | **Zustand + TanStack Query** | TanStack Query handles server state (caching, revalidation, background polling), while Zustand handles active upload states and UI drawers. |
| **Backend Runtime & Framework** | **Node.js + Express + TypeScript** | Robust asynchronous I/O, strict typing, modular feature-based structure, and shared types with the frontend. |
| **Database & Vector Store** | **PostgreSQL with `pgvector`** | Eliminates the need for a separate vector database (like Pinecone or ChromaDB). Keeps document metadata, chunks, embeddings, and job logs in a single ACID-compliant database with `HNSW` vector indexing and cascading deletes. |
| **ORM / Data Access** | **Drizzle ORM** | Native TypeScript support for `pgvector` (`vector('embedding', { dimensions: 768 })`) and cosine similarity operators (`<=>`). Zero runtime overhead, predictable SQL generation, and type-safe migrations. |
| **Background Processing** | **Redis + BullMQ** | Heavy tasks (PDF parsing, text chunking, embedding generation) run asynchronously in worker threads. Prevents Express HTTP request timeouts and provides automatic exponential retries (5s, 10s, 20s). |
| **Binary File Storage** | **Cloudinary SDK** | Secure cloud storage for original document binaries (`raw` resource type). Keeps local server disk lightweight and scalable. |
| **AI Integration** | **Pluggable Architecture (Ollama + Google Gemini)** | Supports both **Local AI** (Ollama `nomic-embed-text` for offline/free operation) and **Cloud AI** (Gemini `text-embedding-004` & `gemini-1.5-flash`). Both embedding models output **768 dimensions**, requiring zero database schema changes when switching providers. |

---

## 4. Ingestion & RAG Data Flow

### A. Document Ingestion Pipeline
1. **Upload & Deduplication**: The user uploads files via drag-and-drop. The backend calculates a SHA-256 hash. If an identical file already exists, it is rejected with HTTP 409 Conflict to save storage and AI costs.
2. **Cloud Storage**: The file is streamed to Cloudinary, returning a secure URL and public ID.
3. **Asynchronous Dispatch**: A document record is saved as `status: 'pending'`, and an ingestion job is pushed to the BullMQ Redis queue. The client receives an immediate `202 Accepted` response.
4. **Coordinate-Aware Extraction**:
   * **PDF**: Extracts page-by-page text (`pageNumber`). Detects scanned PDFs.
   * **Word (DOCX)**: Preserves headings, paragraphs, and markdown tables.
   * **Excel (XLSX)**: Converts sheets into markdown tables with `sheetName` and `rowRange`.
   * **PowerPoint (PPTX)**: Extracts slide text and speaker notes with `slideNumber`.
5. **Chunking & Embedding**: Text is recursively chunked (600 characters, 100 character overlap) while retaining coordinate metadata. 768-dim embeddings are generated and batch-inserted into PostgreSQL.
6. **Real-Time Notification**: The BullMQ worker emits progress events via Server-Sent Events (SSE) to update the client's progress bar.

### B. Retrieval-Augmented Generation (RAG) Query Workflow
1. The user asks a question in the Document Assistant chat.
2. The query is converted into a 768-dim vector embedding.
3. PostgreSQL performs an HNSW cosine distance query (`<=>`) to retrieve the top $K$ relevant chunks.
4. The system constructs a grounded prompt:
   ```
   Answer ONLY using the provided excerpts.
   Every claim must cite [DocName, Page X / Slide Y].
   If the answer is not present, reply: "I cannot find this information in the provided documents."
   
   <context>
   [Doc 1, Page 4]: ...excerpt...
   </context>
   ```
5. The LLM streams the response to the user with interactive citation badges.

---

## 5. Core Application Modules

### 1. Dashboard & Analytics
* Overview statistics: Total documents, successfully processed, pending jobs, failed jobs.
* Storage consumption breakdown (Cloudinary storage, chunk counts, vector counts).
* Document format breakdown chart (PDF vs DOCX vs XLSX vs PPTX).
* Recent uploads and recent search queries.

### 2. Document Management & Ingestion
* Multi-file drag-and-drop upload zone with format chips and size validation (max 25MB).
* SHA-256 duplicate warning and resolution.
* Document Library table with sorting, format icons, chunk counts, and status pills.
* Single-click actions: View Details, Preview File, Download File, Delete Document (with cascade).

### 3. Intelligent Multi-Mode Search Engine
* **Keyword Search**: Exact term matching via PostgreSQL Full-Text Search (`tsvector`/`GIN`) with highlighted snippets.
* **Semantic Search**: Concept-based search using `pgvector` cosine similarity.
* **Hybrid Search**: Combines keyword and semantic ranking using Reciprocal Rank Fusion (RRF).
* **Faceted Filtering**: Filter by format, upload date range, category, and tags.

### 4. AI Document Assistant (Chat & Synthesis)
* **Single-Document Chat**: Ask questions scoped to one document.
* **Multi-Document Cross-Chat**: Query across the entire document corpus.
* **Verifiable Citations**: Interactive badges that open a reference drawer showing the exact source text and page/slide/sheet number.
* **One-Click Pre-Built Actions**: Generate Executive Summary, Extract Key Entities, Generate FAQs.

### 5. Document Comparison Engine
* Select two documents side-by-side.
* Automated text difference analysis (Added, Removed, Modified).
* AI-generated comparative summary highlighting contractual, legal, or numerical changes.

### 6. Processing History & Job Observability
* Real-time BullMQ job timeline (*Queued → Extracting → Chunking → Embedding → Completed*).
* Detailed error logs and failure reasons.
* One-click "Retry Job" button for failed jobs.

### 7. Settings & AI Provider Config
* Switch between **Local AI (Ollama)** and **Cloud AI (Google Gemini)**.
* Test connection pings and view active model configurations.
* Configure chunk size and chunk overlap limits.

---

## 6. Proposed Project Execution Plan

Following our engineering governance, we will execute this in **three structured milestones**:

```
┌────────────────────────────────────────────────────────┐
│  MILESTONE 1: Architecture & Feature Proposal (NOW)    │
│  • Comprehensive Tech Stack Justification              │
│  • Master Feature Catalog (features.md)                │
│  • Mentor Review & Sign-Off                            │
└──────────────────────────┬─────────────────────────────┘
                           │ Approved by Mentor
┌──────────────────────────▼─────────────────────────────┐
│  MILESTONE 2: Interactive HTML Mockup Previews         │
│  • Standalone HTML/CSS mockups for every screen:       │
│    1. Dashboard Page                                   │
│    2. Document Library & Upload Dropzone               │
│    3. Intelligent Search Interface (with highlights)   │
│    4. AI Document Assistant (Chat + Citations)         │
│    5. Document Comparison Split View                   │
│    6. Processing History & Retry Drawer                │
│    7. Settings & Provider Configuration                │
│  • Clickable prototype for mentor review               │
└──────────────────────────┬─────────────────────────────┘
                           │ Approved by Mentor
┌──────────────────────────▼─────────────────────────────┐
│  MILESTONE 3: Incremental Full-Stack Implementation    │
│  • Sub-Project 1: Foundation & Ingestion Pipeline      │
│  • Sub-Project 2: Intelligent Multi-Mode Search        │
│  • Sub-Project 3: RAG Engine & Document Assistant      │
│  • Sub-Project 4: Document Comparison, OCR & Analytics │
└────────────────────────────────────────────────────────┘
```

---

## 7. Immediate Action Item for Mentor Review

Please review:
1. **The Technology Stack**: Are you satisfied with **React (TS) + Express (TS) + PostgreSQL (pgvector via Drizzle) + Redis (BullMQ) + Cloudinary + Local/Cloud AI**?
2. **The Feature Scope**: Does this feature set adequately satisfy the goals of the Document Process and Search Application?
3. **Approval to Proceed**: Upon your approval of this proposal, we will proceed immediately to **Milestone 2: Creating the interactive HTML mockup pages** so you can visually test and validate the user experience before we write any backend code.
