# System Architecture Specification — DocuMind

> **Status**: Production Architecture Blueprint  
> **Target Audience**: Systems Engineers, Architects, and Tech Leads

---

## 1. System Topology & Architectural Tiers

DocuMind is designed around a **modular, feature-based decoupled architecture** ensuring strict separation between synchronous HTTP user transactions, long-running asynchronous worker pipelines, persistent relational/vector storage, and external AI providers.

```
┌────────────────────────────────────────────────────────┐
│                   Frontend Client                      │
│     React 19 · TypeScript · Vite · Tailwind CSS        │
│          shadcn/ui · Zustand · TanStack Query          │
└───────────────────────────┬────────────────────────────┘
                            │ REST APIs & Server-Sent Events (SSE)
┌───────────────────────────▼────────────────────────────┐
│                  Express Backend API                   │
│   • Zod Input Validation & Security Middleware         │
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

## 2. Document Ingestion Pipeline

### Sequence Flow: Upload to Vector Storage
```mermaid
sequenceDiagram
    autonumber
    actor User as Client (React UI)
    participant API as Express API
    participant Cloud as Cloudinary
    participant Redis as Redis (BullMQ)
    participant Worker as Ingestion Worker
    participant DB as PostgreSQL (pgvector)
    participant AI as AI Embedder (Gemini/Ollama)

    User->>API: POST /api/upload (Multipart binary)
    API->>API: Inspect Magic Bytes (file-type)
    API->>API: Compute SHA-256 Checksum
    API->>DB: Check if SHA-256 exists
    alt Duplicate Detected
        API-->>User: 409 Conflict ("Duplicate file detected")
    else Unique Document
        API->>Cloud: Stream file buffer (resource_type: raw)
        Cloud-->>API: Return secure URL & public_id
        API->>DB: INSERT INTO documents (status: 'pending')
        API->>Redis: Enqueue Job ('document-processing', docId)
        API-->>User: 202 Accepted (docId, jobId)
        User->>API: GET /api/jobs/:id/progress (Subscribe SSE)
    end

    Redis->>Worker: Dispatch Job (docId)
    Worker->>API: Emit SSE (EXTRACTING, 25%)
    Worker->>Worker: Parse file (PDF / DOCX / XLSX / PPTX)
    Worker->>Worker: Tag structural coordinates (page, sheet, slide)
    Worker->>API: Emit SSE (CHUNKING, 50%)
    Worker->>Worker: Recursive character chunker (600 chars, 100 overlap)
    Worker->>API: Emit SSE (EMBEDDING, 75%)
    Worker->>AI: Generate 768-dim embeddings (batch with p-limit)
    AI-->>Worker: Return embedding vectors
    Worker->>DB: Batch INSERT INTO document_chunks (text, coords, vector)
    Worker->>DB: UPDATE documents SET status='completed', chunk_count=N
    Worker->>API: Emit SSE (COMPLETED, 100%)
    API-->>User: SSE Event ("Job Complete")
```

---

## 3. Intelligent Search & Retrieval Architecture

DocuMind avoids single-method retrieval by executing a **parallel hybrid retrieval pipeline** fusing full-text lexical ranking with high-dimensional vector similarity.

```mermaid
flowchart TD
    Q["User Search Query"] --> KW["PostgreSQL Full-Text Search\n(tsvector @@ websearch_to_tsquery)"]
    Q --> EMB["Query Vectorizer\n(768-dim Embedding)"]
    EMB --> SEM["pgvector Cosine Similarity\n(HNSW index: vector <=> embedding)"]

    KW --> |Top K Lexical Matches| RRF["Reciprocal Rank Fusion (RRF) Engine\nScore = 1/(60 + Rank_kw) + 1/(60 + Rank_sem)"]
    SEM --> |Top K Semantic Matches| RRF

    RRF --> DEDUP["Deduplication & Metadata Merging"]
    DEDUP --> SNIP["Highlight Snippet Generator\n(ts_headline)"]
    SNIP --> OUT["Ranked Search Results Payload"]
```

### Reciprocal Rank Fusion (RRF) Implementation
When combining ranking lists from heterogeneous scoring scales (lexical BM25/`ts_rank` scores are unbound, while cosine distances are in $[0, 2]$), normal score addition leads to bias. RRF normalizes using pure rank positions:
$$RRF\_Score(d \in D) = \sum_{m \in M} \frac{1}{k + r_m(d)}$$
* $k = 60$ (smoothing constant preventing high-rank dominance)
* $r_m(d)$ is the 1-based rank of document chunk $d$ in retrieval system $m$.

---

## 4. Grounded RAG Assistant Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User as User Chat Interface
    participant RAG as RAG Controller
    participant Search as Hybrid Retrieval Engine
    participant DB as PostgreSQL (pgvector)
    participant LLM as LLM Engine (Gemini 1.5 Flash / Ollama)

    User->>RAG: POST /api/chat/rag (query, docScope)
    RAG->>Search: Retrieve Top K Chunks (K=5)
    Search->>DB: Execute HNSW Search with metadata
    DB-->>Search: Return text chunks with [page, sheet, slide]
    Search-->>RAG: Filtered Top 5 Relevant Chunks
    
    RAG->>RAG: Construct Grounded Context Prompt
    Note over RAG: Injects strict anti-hallucination rules:<br/>"Answer ONLY from context. Cite [DocName, Page X]"
    
    RAG->>LLM: Stream prompt to LLM
    LLM-->>RAG: Stream token response
    RAG-->>User: Stream Server-Sent Events with Citation Badges
    User->>RAG: Click Citation Badge
    RAG-->>User: Display Source Coordinate Drawer
```

---

## 5. Pluggable AI Engine Architecture

To guarantee flexibility and zero lock-in, DocuMind defines a clean provider interface:

```typescript
export interface EmbeddingProvider {
  dimensions: number; // Standardized to 768
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
}

export interface ChatProvider {
  generateGroundedResponse(
    query: string,
    contextChunks: DocumentChunk[],
    history: ChatMessage[]
  ): AsyncIterable<string>;
}
```

* **Local AI**: `OllamaEmbeddingAdapter` connects to local Ollama daemon (`localhost:11434`) using `nomic-embed-text`.
* **Cloud AI**: `GeminiEmbeddingAdapter` connects to Google Cloud Vertex/Gemini API using `text-embedding-004`.
* Both output **768 dimensions**, requiring **zero PostgreSQL schema changes** when switching providers via the Settings UI.
