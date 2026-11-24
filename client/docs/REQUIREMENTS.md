# Frontend Client Requirements Specification — DocuMind

> **Package**: `client/`  
> **Framework**: React 19 + TypeScript + Vite  
> **UI Layer**: Tailwind CSS + shadcn/ui

---

## 1. Client Functional Requirements (CR)

### CR1: Document Ingestion & Upload Dropzone
* **CR1.1**: The UI shall provide a prominent drag-and-drop upload zone supporting multi-file selection of PDF, DOCX, XLSX, and PPTX files.
* **CR1.2**: The client shall enforce client-side file extension and size validation (max 25MB per file) before dispatching the upload request.
* **CR1.3**: During upload, the client shall track real-time upload progress percentage via Axios `onUploadProgress`.
* **CR1.4**: If the server returns HTTP `409 Conflict` (SHA-256 duplicate detection), the client shall display an informative warning toast without crashing the queue.
* **CR1.5**: Upon upload acceptance (`202 Accepted`), the client shall automatically bind to the job's Server-Sent Events (SSE) stream to display live milestone progress: `EXTRACTING` (25%) → `CHUNKING` (50%) → `EMBEDDING` (75%) → `COMPLETED` (100%).

---

### CR2: Document Library & Management Table
* **CR2.1**: The client shall render all processed documents in an enterprise data table featuring:
  * File format icon (PDF red, Word blue, Excel green, PPT orange).
  * Document title and original filename.
  * Extracted chunk count badge.
  * Status pill (`Pending`, `Processing`, `Completed`, `Failed`).
  * Upload date with human-readable relative time (e.g., "2 hours ago").
* **CR2.2**: The table shall support sorting by date, title, and size, with client-driven pagination.
* **CR2.3**: Deleting a document shall trigger a modal confirmation dialog explaining that all associated vector embeddings will be permanently expunged.

---

### CR3: Intelligent Multi-Mode Search Interface
* **CR3.1**: The search page shall feature a centralized search bar with a debounced input (300ms) and instant clear button.
* **CR3.2**: Users shall be able to toggle search modes using interactive segmented pills:
  * **Hybrid (Default)**: Combines semantic context and exact keywords via RRF.
  * **Semantic**: Conceptual vector similarity.
  * **Keyword**: Lexical PostgreSQL Full-Text Search.
* **CR3.3**: The search view shall include a collapsible faceted filter sidebar allowing filtering by file format (`.pdf`, `.docx`, `.xlsx`, `.pptx`) and upload date range.
* **CR3.4**: Search result cards must display:
  * Document title with clickable link to chat.
  * Structural location tag (e.g., `Page 14`, `Sheet: Financials, Rows B2:D18`, `Slide 7`).
  * Highlighted text snippets with matching terms styled in an electric blue highlight badge.
  * Relevance score indicator pill.

---

### CR4: AI Document Assistant (Chat & Citation Drawer)
* **CR4.1**: The chat interface shall allow asking questions scoped to a **single document** or across the **entire document corpus**.
* **CR4.2**: The client shall consume the server's streaming SSE response, rendering markdown tokens progressively with auto-scroll.
* **CR4.3**: Citations returned by the model must render as interactive, clickable badges (e.g. `[Citation: SLA_Agreement.pdf, Page 12]`).
* **CR4.4**: Clicking any citation badge shall slide open a **Reference Drawer** displaying the exact underlying text chunk and coordinate metadata.

---

### CR5: Processing History & Job Observability
* **CR5.1**: The client shall provide a slide-over drawer displaying recent BullMQ ingestion jobs.
* **CR5.2**: For failed jobs, the drawer shall render the failure reason and provide a one-click "Retry Ingestion" button.

---

### CR6: Settings & AI Provider Switching
* **CR6.1**: The client shall provide a Settings view displaying the active AI provider (Local Ollama vs. Cloud Gemini).
* **CR6.2**: Users shall be able to switch providers and click "Test Connection" to verify endpoint reachability.

---

## 2. Client Non-Functional Requirements (CNFR)

* **CNFR1 (Zero Stored XSS)**: All highlighted snippets and extracted text strings rendered in the DOM **must be sanitized using `DOMPurify`** before mounting.
* **CNFR2 (Performance)**: First Contentful Paint (FCP) must remain **<1.0s**, and table scrolling must maintain **60 FPS**.
* **CNFR3 (Accessibility)**: The interface must comply with WCAG 2.1 AA standards, featuring keyboard navigation, visible focus rings, and high-contrast color ratios.
* **CNFR4 (State Segregation)**: Server state must reside exclusively in TanStack Query; UI state must reside in Zustand.
