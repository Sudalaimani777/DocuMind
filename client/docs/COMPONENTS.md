# Component Inventory & Composite Patterns — DocuMind Client

> **Package**: `client/src/components/` & `client/src/features/`  
> **UI Primitives**: shadcn/ui (Radix Primitives) + Lucide React Icons

---

## 1. Component Architecture & Layering

DocuMind divides components into two distinct layers:
1. **Reusable Primitives (`src/components/ui/`)**: Pure UI building blocks copied from shadcn/ui with no business or domain logic.
2. **Domain Composite Components (`src/features/*/components/`)**: Composed feature components wired to TanStack Query hooks, Zustand stores, and domain event handlers.

---

## 2. shadcn/ui Primitive Inventory (`src/components/ui/`)

| Primitive Component | Underlying Radix Primitive | Role in DocuMind |
| :--- | :--- | :--- |
| **`Button`** | `@radix-ui/react-slot` | Primary actions, icon buttons, mode selector tabs. |
| **`Card`** | Native Semantic Div | Search result cards, upload dropzone wrapper, stats cards. |
| **`Dialog`** | `@radix-ui/react-dialog` | Modal popups (Document delete confirmation). |
| **`Drawer`** | `vaul` | Slide-over panels (Citation Source Drawer, Processing History). |
| **`Badge`** | Native Semantic Span | Status pills (`completed`, `failed`), format tags (`PDF`, `XLSX`). |
| **`Progress`** | `@radix-ui/react-progress` | Ingestion milestone progress bar (0% to 100%). |
| **`Input`** | Native Semantic Input | Search text bar, filter inputs. |
| **`Select`** | `@radix-ui/react-select` | Format dropdown filter, provider selector. |
| **`Table`** | Native Semantic Table | Document library data table with sorting headers. |
| **`Tabs`** | `@radix-ui/react-tabs` | Search mode segmented controller (`Hybrid`, `Semantic`, `Keyword`). |
| **`Tooltip`** | `@radix-ui/react-tooltip` | Hover explanations for chunk coordinates and SHA-256 hashes. |
| **`Sonner`** | `sonner` | Toast notification provider for upload and error alerts. |

---

## 3. Core Composite Feature Components

### 3.1 `UploadDropzone` (`src/features/upload/components/UploadDropzone.tsx`)
* **Role**: Primary upload surface accepting single or multiple files.
* **States**:
  * `idle`: Shows upload cloud icon, accepted formats, and 25MB limit label.
  * `dragover`: Displays pulsating electric blue border (`border-blue-500 bg-blue-500/10`).
  * `uploading`: Lists files in active upload queue with individual percentage progress bars.
  * `error`: Highlights validation failures (e.g. file size exceeding 25MB or invalid extension).
* **Key Props / Store Connection**: Reads and writes to `useUploadStore`.

---

### 3.2 `DocumentTable` (`src/features/documents/components/DocumentTable.tsx`)
* **Role**: Primary catalog view for all processed documents.
* **Features**:
  * Format badge with color signature (PDF red, Word blue, Excel green, PPT orange).
  * Document title and relative upload timestamp.
  * Chunk count pill (`N chunks`).
  * Real-time SSE status indicator (`Pending`, `Processing` with animated spinner, `Completed`, `Failed`).
  * Action triggers: "Chat with Document", "View Metadata", "Delete".

---

### 3.3 `SearchResultCard` (`src/features/search/components/SearchResultCard.tsx`)
* **Role**: Displays an individual match from the hybrid search engine.
* **Structure**:
  ```
  ┌────────────────────────────────────────────────────────┐
  │ [PDF Badge] 2026-Financial-Audit.pdf       Score: 0.038│
  │ Coordinate Tag: Page 14                                │
  ├────────────────────────────────────────────────────────┤
  │ "...operating income grew by 18% with <mark>Q3 EBITDA  │
  │ margins</mark> expanding 240bps to 18.2% across..."    │
  ├────────────────────────────────────────────────────────┤
  │ [Chat with Document Button]        [View Full Chunk]   │
  └────────────────────────────────────────────────────────┘
  ```
* **Security**: Enforces `DOMPurify.sanitize(highlightedContent)` before rendering.

---

### 3.4 `ChatInterface` (`src/features/chat/components/ChatInterface.tsx`)
* **Role**: Interactive RAG Q&A interface.
* **Features**:
  * Chat history container with auto-scroll to bottom.
  * User message bubble (Deep Slate background).
  * Assistant response bubble with real-time streaming markdown parsing.
  * Interactive clickable citation pills:
    * Tag: `[Citation: Master_Agreement.docx, Page 12]`
    * Click Handler: Opens `CitationDrawer` with that specific chunk's content.

---

### 3.5 `CitationDrawer` (`src/features/chat/components/CitationDrawer.tsx`)
* **Role**: Grounded evidence drawer proving zero AI hallucinations.
* **Displays**:
  * Document title and format icon.
  * Specific coordinate metadata (`Page Number`, `Sheet Name & Row Range`, `Slide Number`).
  * Complete verbatim chunk text excerpt (600 characters).
  * Chunk vector similarity score.

---

### 3.6 `JobTimelineDrawer` (`src/features/history/components/JobTimelineDrawer.tsx`)
* **Role**: Processing observability and failure recovery.
* **Displays**:
  * Step-by-step pipeline milestones (`QUEUED` → `EXTRACTING` → `CHUNKING` → `EMBEDDING` → `COMPLETED`).
  * Failed job error log with expandable stack trace.
  * One-click "Retry Job" button triggering `POST /api/jobs/:id/retry`.
