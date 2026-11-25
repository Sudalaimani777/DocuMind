# Technology Stack & Technical Justifications — DocuMind

> **Status**: Production Reference Document  
> **Scope**: Monorepo Frontend, Backend, Database, Infrastructure, and Security Layers

---

## 1. Master Technology Stack Matrix

| Layer / Category | Chosen Technology | Version | Purpose in Platform | Technical Justification (Why This Over Alternatives) |
| :--- | :--- | :---: | :--- | :--- |
| **Frontend Framework** | **React** | `19.x` | Core SPA rendering engine | Declarative component model, latest concurrent rendering, massive ecosystem, and industry standard adoption. |
| **Language & Typings** | **TypeScript** | `5.x` | End-to-end type safety | Eliminates runtime bugs, enables shared type contracts between client and server, and provides superior IDE autocomplete. |
| **Build Tool & Bundler** | **Vite** | `6.x` | Local dev server & bundling | Sub-second Hot Module Replacement (HMR) powered by native ES modules. Far faster than legacy Webpack or Create-React-App. |
| **Styling & Design System** | **Tailwind CSS + shadcn/ui** | `v3.4+ / Radix` | Enterprise UI components | Provides accessible, unstyled Radix primitives with complete utility-class control. Avoids generic "AI template" styles. |
| **State Management** | **Zustand + TanStack Query** | `v5.x` | Client & server state management | **TanStack Query** manages server caching, background revalidation, and request deduplication. **Zustand** manages client UI state with zero boilerplate. |
| **HTTP Client** | **Axios** | `v1.7+` | REST API communication | Built-in request/response interceptors, automatic JSON transformation, upload progress monitoring, and clean error boundaries. |
| **XSS Defense & Real-Time** | **DOMPurify & Server-Sent Events** | `v3.x / Native` | Sanitization & live progress | **DOMPurify** sanitizes extracted HTML/highlights to block Stored XSS. **SSE** streams unidirectional progress without WebSocket overhead. |
| **Backend Framework** | **Node.js + Express** | `v20.x / 4.x` | Asynchronous REST API server | High-throughput asynchronous event loop, extensive parsing ecosystem, and seamless TypeScript integration. |
| **Input Validation** | **Zod** | `v3.x` | Runtime schema validation | Validates incoming payloads before hitting controllers, auto-infers TypeScript types, and prevents malformed data injection. |
| **API & Cost Security** | **Helmet, CORS & express-rate-limit** | `Latest` | Infrastructure guardrails | **Helmet** sets secure HTTP headers. **CORS** restricts origins. **express-rate-limit** protects against DoS and runaway LLM billing spikes. |
| **Upload Middleware** | **Multer** | `v1.4+` | File ingestion & buffer control | Handles `multipart/form-data` with in-memory buffering and strict 25MB limits prior to parsing or storage. |
| **File Signature Security** | **file-type** | `v19.x` | Magic-bytes spoofing detection | Pure JS/WASM file signature checker. Rejects `.exe` or `.html` files renamed to `.pdf` regardless of client headers. |
| **Image Integrity & Previews** | **Sharp** | `v0.33+` | Thumbnail & image validation | Ultra-fast C++ image processor (`libvips`). Strips malicious EXIF metadata and generates document page thumbnails. |
| **Multi-Format Parsers** | **pdf-parse, mammoth, xlsx, pptx2json** | `Latest` | Coordinate-aware extraction | Dedicated parsers for PDF, Word, Excel, and PowerPoint that preserve page numbers, headings, tables, and slide notes. |
| **Background Job Queue** | **Redis + BullMQ** | `v5.x` | Asynchronous worker queues | Offloads CPU-intensive extraction and embedding from HTTP threads. Provides automatic exponential backoff retries (5s, 10s, 20s). |
| **Database & Vector Store** | **Supabase (PostgreSQL with `pgvector`)** | `v16+ / 0.7+` | Managed relational & vector database | Combines ACID relational data and 768-dim vector embeddings in a single managed Supabase PostgreSQL instance. Eliminates costly external vector DBs (Pinecone). |
| **ORM & Database Access** | **Drizzle ORM** | `v0.36+` | Type-safe SQL & vector queries | Native support for `pgvector` (`vector('embedding', { dimensions: 768 })`) and cosine similarity (`<=>`). Zero runtime overhead compared to Prisma. |
| **Cloud Document Storage** | **Cloudinary SDK** | `v2.x` | Binary file storage | Secure off-server storage for original documents (`raw` resource type) keeping local server disk lightweight and scalable. |
| **Pluggable AI Engine** | **Ollama & Google Gemini API** | `Latest` | 768-dim embeddings & RAG | Dual-adapter architecture supporting free local offline AI (Ollama `nomic-embed-text`) and cloud AI (Gemini `text-embedding-004`). |

---

## 2. Key Architectural Comparisons & Trade-offs

### 1. PostgreSQL (`pgvector`) vs. Dedicated Vector DBs (Pinecone, Chroma, Milvus)
* **Chosen**: PostgreSQL + `pgvector` via Drizzle ORM.
* **Why**: Dedicated vector databases introduce distributed state, separate network hops, complex transactional rollback issues, and significant SaaS costs. `pgvector` stores document metadata, processing logs, chunks, and embeddings within a single ACID-compliant database. Deleting a document triggers a clean database-level cascading delete that wipes all chunks and vectors in one atomic operation.

### 2. Drizzle ORM vs. Prisma ORM
* **Chosen**: Drizzle ORM.
* **Why**: Prisma requires a heavy Rust engine binary and has cumbersome support for custom SQL operators like `pgvector` cosine similarity (`<=>`). Drizzle is a lightweight TypeScript query builder with native `pgvector` extension support, instant startup times, zero overhead, and SQL-like predictability.

### 3. Redis + BullMQ vs. In-Memory Job Queues
* **Chosen**: Redis + BullMQ.
* **Why**: In-memory queues (like simple JavaScript `async` queues) lose all jobs if the server crashes or restarts. BullMQ persists queue state in Redis, supports multiple concurrent workers, provides sandboxed execution, and manages automatic exponential retries with dead-letter queue handling.

### 4. Server-Sent Events (SSE) vs. WebSockets
* **Chosen**: Server-Sent Events (SSE).
* **Why**: Document ingestion progress is strictly unidirectional (server pushing progress updates to client). SSE operates over standard HTTP, natively handles reconnection, avoids the complexity of WebSocket handshakes, and works seamlessly with reverse proxies and firewalls.
