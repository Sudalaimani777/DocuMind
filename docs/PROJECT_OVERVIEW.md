# Project Overview — DocuMind

> **Tagline**: *Intelligence Beyond Documents*  
> **Document Status**: Production Specification  
> **Target Audience**: Mentors, System Architects, Engineers, and Stakeholders

---

## 1. Vision & Executive Summary

Modern knowledge organizations accumulate massive libraries of heterogeneous documents: legal contracts in PDF, technical specifications in Word (`.docx`), financial ledgers in Excel (`.xlsx`), and board presentations in PowerPoint (`.pptx`).

Traditional enterprise search systems treat documents as flat text dumps. They search for exact string matches without understanding conceptual intent, fail to capture tabular structures or slide hierarchies, and return entire documents rather than surgical answers. Conversely, generic generative AI tools hallucinate details because they lack deterministic citation boundaries linking generated answers back to the original source.

**DocuMind** is an enterprise-grade document intelligence platform that bridges this gap. It ingests multi-format documents, preserves structural coordinates (pages, sheets, rows, and slides), generates 768-dimensional vector embeddings, and enables **hybrid search (keyword + semantic + Reciprocal Rank Fusion)** and **grounded RAG (Retrieval-Augmented Generation)** with interactive, verifiable citations.

---

## 2. Core Problem Statement

| Challenge | Real-World Impact | How DocuMind Solves It |
| :--- | :--- | :--- |
| **Keyword Search Blindness** | Traditional full-text search misses synonyms, paraphrasing, and contextual meaning (e.g., searching "revenue growth" fails to match "top-line expansion"). | Combines PostgreSQL Full-Text Search (`tsvector`) with `pgvector` HNSW cosine similarity search (`<=>`) fused via Reciprocal Rank Fusion (RRF). |
| **Loss of Coordinate Context** | Standard extractors flatten tabular rows in Excel, speaker notes in PowerPoint, and multi-column PDFs into unreadable text blobs. | Coordinate-aware parsers tag every text chunk with metadata: `pageNumber`, `sheetName`, `rowRange`, and `slideNumber`. |
| **Generative Hallucinations** | Generic LLMs invent numbers and citations, making them unacceptable for compliance, legal, or financial use. | Anti-hallucination prompt guardrails constrain the LLM to provide answers derived *strictly* from retrieved chunks with interactive citation badges. |
| **HTTP Request Timeouts** | Parsing a 100-page PDF and generating vector embeddings blocks the HTTP event loop, crashing Node.js or timing out requests. | Asynchronous job dispatching using Redis and BullMQ with Server-Sent Events (SSE) streaming live progress to the user. |
| **Duplicate Storage & Cost Waste** | Re-uploading identical documents wastes cloud storage and incurs duplicate AI embedding API charges. | Cryptographic `SHA-256` binary hashing validates uniqueness immediately on upload, returning HTTP `409 Conflict` on duplicates. |

---

## 3. User Personas & Use Cases

### Persona A: Financial & Research Analyst
* **Goal**: Query quarterly financial results across hundreds of spreadsheets and presentation decks.
* **DocuMind Workflow**: Ingests `.xlsx` balance sheets and `.pptx` investor decks. Searches for "EBITDA margins in Q3" and receives an answer citing the exact Excel sheet and row range.

### Persona B: Legal & Compliance Officer
* **Goal**: Audit vendor service level agreements (SLAs) and contractual terms across PDFs and Word documents.
* **DocuMind Workflow**: Queries "penalties for service outage exceeding 4 hours". The AI assistant answers with direct citations linking to Page 14 of the master agreement.

### Persona C: Technical Documentation Specialist
* **Goal**: Search internal technical handbooks and engineering slides without reading through entire manuals.
* **DocuMind Workflow**: Executes hybrid search, reviews highlighted search snippet cards, and chats across multiple documents simultaneously.

---

## 4. Key Platform Capabilities

```
┌────────────────────────────────────────────────────────┐
│                   DOCUMIND CAPABILITIES                │
├────────────────────────┬───────────────────────────────┤
│ 1. Multi-Format        │ PDF (page tracking, scan-chk) │
│    Coordinate Parsers  │ DOCX (markdown tables, hdgs)  │
│                        │ XLSX (sheets, row ranges)     │
│                        │ PPTX (slides, speaker notes)  │
├────────────────────────┼───────────────────────────────┤
│ 2. Hybrid Search       │ Full-Text Search (tsvector)   │
│    Engine              │ pgvector Cosine Similarity    │
│                        │ Reciprocal Rank Fusion (RRF)  │
├────────────────────────┼───────────────────────────────┤
│ 3. Grounded RAG        │ Single & Multi-doc Chat       │
│    Assistant           │ Verifiable Citation Drawer    │
│                        │ Strict Anti-Hallucination     │
├────────────────────────┼───────────────────────────────┤
│ 4. Asynchronous        │ Redis + BullMQ Queue          │
│    Processing & SSE    │ Exponential Backoff Retries   │
│                        │ Real-Time Progress Stream     │
├────────────────────────┼───────────────────────────────┤
│ 5. Multi-Layer         │ Magic Bytes Check (file-type) │
│    Security Controls   │ 25MB Multer Buffer Limit      │
│                        │ DOMPurify Stored XSS Defense  │
└────────────────────────┴───────────────────────────────┘
```

---

## 5. Scope Boundaries

### In-Scope (Approved Features)
1. Monorepo architecture (React 19 + Vite frontend, Express + TypeScript backend).
2. Direct local/cloud service connections: PostgreSQL with `pgvector`, Redis, Cloudinary.
3. Multi-format parsing: PDF, DOCX, XLSX, PPTX with coordinate preservation.
4. Cryptographic deduplication (SHA-256) and magic-bytes file validation.
5. Asynchronous BullMQ worker queue with live SSE progress stream.
6. Three search modes: Keyword, Semantic, and Hybrid RRF with highlighted snippets.
7. Grounded RAG Q&A with clickable citation badges and source preview drawer.
8. Job observability dashboard with one-click retry for failed jobs.
9. Pluggable AI provider configuration (Ollama local vs. Google Gemini cloud).

### Explicitly Out-of-Scope (Excluded from MVP)
* **Docker Containerization**: All services run natively on host or cloud endpoints.
* **Feature 5 (One-Click Bulk Actions)**: Batch archiving or bulk mass edits are excluded.
* **Feature 6 (Document-to-Document Visual Comparison)**: Side-by-side diff comparison is excluded.
* **Native In-App Billing / Subscriptions**: Out of scope for current enterprise MVP.

---

## 6. Success Metrics & Key Performance Indicators (KPIs)

* **Deduplication Rate**: 100% detection of duplicate file uploads prior to cloud storage or embedding.
* **Ingestion Throughput**: Sub-5 second asynchronous queuing of files up to 25MB.
* **Search Latency**: <150ms for hybrid RRF queries against 10,000 document chunks using PostgreSQL HNSW vector indexes.
* **Citation Accuracy**: 100% of generated RAG assertions must cite verifiable source coordinates (`[DocName, Page X / Sheet Y]`).
* **Security Zero-Day Defense**: Zero arbitrary file execution through enforced magic-bytes verification and Cloudinary `raw` streaming.
