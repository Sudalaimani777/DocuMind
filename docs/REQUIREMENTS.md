# System Requirements Specification (SRS) — DocuMind

> **Status**: Production Specification  
> **Standard**: IEEE 830-compliant Functional & Non-Functional Requirements

---

## 1. Functional Requirements (FR)

### FR1: File Upload, Validation & Deduplication
* **FR1.1**: The system shall accept documents in PDF (`.pdf`), Word (`.docx`), Excel (`.xlsx`), and PowerPoint (`.pptx`) formats.
* **FR1.2**: The system shall enforce a strict maximum file size limit of **25 MB** per file and up to **5 files** per batch upload.
* **FR1.3**: The system shall inspect the binary magic bytes using `file-type` to verify that the file's binary header matches its declared MIME type, rejecting spoofed extensions with HTTP `400 Bad Request`.
* **FR1.4**: The system shall compute a cryptographic `SHA-256` hash of the file buffer immediately upon receipt.
* **FR1.5**: If an identical SHA-256 hash already exists in the database, the system shall reject the upload with HTTP `409 Conflict`, citing duplicate detection to prevent redundant storage and AI embedding costs.
* **FR1.6**: Verified unique files shall be streamed directly to Cloudinary using resource type `raw` and assigned a secure, unique storage identifier.

---

### FR2: Multi-Format Coordinate-Aware Extraction
* **FR2.1 (PDF Extraction)**: The system shall extract text page-by-page using `pdf-parse`, tagging each page's text with its `pageNumber`. The parser shall detect scanned PDFs containing zero extracted text and flag them with an informative user warning.
* **FR2.2 (Word Extraction)**: The system shall extract text from `.docx` files using `mammoth`, preserving heading hierarchies, paragraph structure, and converting tabular elements into structured Markdown tables.
* **FR2.3 (Excel Extraction)**: The system shall parse `.xlsx` files using `xlsx`, extracting every non-empty sheet into Markdown table representations, tagging chunks with `sheetName` and `rowRange` (e.g., `Sheet1!A1:D25`).
* **FR2.4 (PowerPoint Extraction)**: The system shall parse `.pptx` slides and presenter speaker notes using `pptx2json`, tagging chunks with `slideNumber`.
* **FR2.5**: The system shall handle corrupted or password-protected files gracefully by failing the specific job and logging a clear, user-readable error reason.

---

### FR3: Coordinate-Preserving Chunking & Embedding Generation
* **FR3.1**: The system shall recursively chunk extracted text using a sliding window algorithm configured to **600 characters** per chunk with a **100-character overlap**.
* **FR3.2**: Every chunk must inherit and retain its structural coordinates (`pageNumber`, `sheetName`, `rowRange`, `slideNumber`, `documentId`).
* **FR3.3**: The system shall support pluggable embedding generation with a standardized output dimension of **768**:
  * **Local AI**: Ollama `nomic-embed-text` (768 dimensions).
  * **Cloud AI**: Google Gemini `text-embedding-004` (768 dimensions).
* **FR3.4**: Embeddings shall be batch-inserted into PostgreSQL `document_chunks` table within a single transactional boundary.

---

### FR4: Intelligent Multi-Mode Search Engine
* **FR4.1 (Keyword Search)**: The system shall execute full-text search using PostgreSQL `tsvector` with English dictionary stemming and `ts_rank` relevance scoring, returning highlighted snippets using `ts_headline`.
* **FR4.2 (Semantic Search)**: The system shall generate an embedding for the user's query and perform cosine distance similarity search (`<=>`) against stored chunks using an `HNSW` vector index.
* **FR4.3 (Hybrid Search)**: The system shall combine keyword and semantic search results using **Reciprocal Rank Fusion (RRF)**:
  $$\text{RRF\_Score}(d) = \sum_{m \in \{\text{keyword}, \text{semantic}\}} \frac{1}{k + r_m(d)}$$
  *(where $k = 60$ and $r_m(d)$ is the document's rank in mode $m$)*.
* **FR4.4 (Faceted Filtering)**: The search API shall accept optional filters for document format (`pdf`, `docx`, `xlsx`, `pptx`), upload date range, and tags.

---

### FR5: Grounded RAG Assistant & Verifiable Citations
* **FR5.1**: The system shall allow users to chat with a **single document** or query across the **entire document library**.
* **FR5.2**: The retrieval engine shall select the top $K$ ($K=5$) chunks based on hybrid relevance scores.
* **FR5.3**: The prompt to the LLM (Gemini 1.5 Flash / Ollama Llama 3) shall strictly mandate:
  * Grounded synthesis based *only* on the provided context excerpts.
  * Explicit citation tags in the format `[Citation: DocName, Page X / Sheet Y]`.
  * Deterministic refusal ("I cannot find this information in the uploaded documents") when context does not contain the answer.
* **FR5.4**: The frontend shall parse citation tags into interactive clickable pills that open a reference drawer showing the exact source text snippet and coordinate metadata.

---

### FR6: Job Queue Observability & Resiliency
* **FR6.1**: All heavy ingestion tasks must execute in a background BullMQ queue backed by Redis.
* **FR6.2**: The worker shall emit real-time progress events over **Server-Sent Events (SSE)** at each milestone: `QUEUED` (0%) → `EXTRACTING` (25%) → `CHUNKING` (50%) → `EMBEDDING` (75%) → `COMPLETED` (100%).
* **FR6.3**: Failed jobs shall automatically retry up to 3 times with exponential backoff (5s, 10s, 20s).
* **FR6.4**: The system shall provide a "Processing History" drawer displaying job logs and offering a one-click "Retry" button for failed jobs.

---

### FR7: Settings & Provider Configuration
* **FR7.1**: The system shall provide a Settings interface allowing users to switch active AI provider between **Local AI (Ollama)** and **Cloud AI (Google Gemini)** without server restarts.
* **FR7.2**: The system shall offer a "Test Connection" button verifying that the selected provider endpoint is reachable and responsive.

---

## 2. Non-Functional Requirements (NFR)

| ID | Category | Requirement Specification |
| :--- | :--- | :--- |
| **NFR1** | **Performance** | Hybrid search queries against 10,000 chunks shall respond in **<150ms**. RAG streaming response shall emit its initial token in **<1.2s** on Cloud AI. |
| **NFR2** | **Security** | The API shall set secure HTTP headers via `Helmet`, whitelist origins via `CORS`, and enforce rate limits (`10 uploads/min`, `60 searches/min`, `30 RAG queries/min`). |
| **NFR3** | **Data Integrity** | Cascading deletes must be enforced at the database level: deleting a document shall automatically delete all associated chunks, vector embeddings, and job logs in a single transaction. |
| **NFR4** | **Input Sanitization** | All extracted document text and search highlights rendered on the frontend must pass through `DOMPurify` to eliminate Stored Cross-Site Scripting (XSS). |
| **NFR5** | **Zero Docker** | The system must run natively on host operating systems (Windows 11, macOS, Linux) without Docker container dependencies. |
| **NFR6** | **Usability** | The client interface must adhere to WCAG 2.1 AA accessibility guidelines, support keyboard navigation, and provide responsive layouts for desktop and tablet screens. |
