# Phase 3: Grounded AI Assistant & Chat History — Design Specification

**Date**: 2026-11-26  
**Branch**: `feat/phase-3-rag-assistant-chat-history`  
**Status**: Approved Design (Pending Spec Review)  
**Target Screens**: `/chat`, `/chat/:documentId`, `/history`

---

## 1. Overview & Decisions

Phase 3 delivers DocuMind's grounded conversational RAG assistant and persistent chat history on top of the Phase 1 ingestion pipeline and Phase 2 Hybrid RRF search engine.

### Core Design Decisions
1. **Multi-Turn Sliding Window**: Conversation sessions pass the most recent 6 messages (3 user/assistant pairs) into the prompt and retrieval context so follow-up questions resolve naturally without unbounded token growth.
2. **Locked Per-Session Document Scope**: A session created on `/chat` searches all documents owned by the user (`documentId = null`). A session created on `/chat/:documentId` is permanently scoped to that document (`chat_sessions.document_id`). Changing the target document in the UI starts a new session.
3. **Indexed-Marker Citation Streaming (Approach A)**: Retrieved chunks are numbered `[1]..[N]` in `<document_context>`. The LLM cites assertions inline with `[1]`, `[2]`, etc. As tokens stream over SSE, the server resolves each referenced `[k]` to its verified `CitationDTO` and emits `event: citation` payloads, eliminating fragile regex matching of freeform filenames/page numbers.
4. **Unified `/api/v1/chat/*` Namespace**: All new endpoints live under `/api/v1/chat/*` (`POST /api/v1/chat/rag`, `GET /api/v1/chat/sessions`, `GET /api/v1/chat/sessions/:id/messages`, `DELETE /api/v1/chat/sessions/:id`), protected by `requireAuth` and Zod validation.

---

## 2. Database Schema & Shared Contracts

### 2.1 PostgreSQL Tables (`server/src/core/db/schema.ts`)

#### `chat_sessions`
| Column | Type | Constraints | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Session identifier |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Private workspace owner |
| `document_id` | `UUID` | `NULLABLE REFERENCES documents(id) ON DELETE SET NULL` | Locked single-doc scope |
| `title` | `VARCHAR(255)` | `NOT NULL` | Auto-generated 4–6 word title |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Updated on each new message |

- Index: `idx_chat_sessions_user_id` on `(user_id, updated_at DESC)`

#### `chat_messages`
| Column | Type | Constraints | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Message identifier |
| `session_id` | `UUID` | `NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE` | Parent session |
| `role` | `VARCHAR(20)` | `NOT NULL` | `'user'` or `'assistant'` |
| `content` | `TEXT` | `NOT NULL` | Raw prompt or assistant markdown |
| `citations` | `JSONB` | `NOT NULL DEFAULT '[]'` | Array of `CitationDTO` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Chronological ordering |

- Index: `idx_chat_messages_session_id` on `(session_id, created_at ASC)`

Drizzle relations (`usersRelations`, `documentsRelations`, `chatSessionsRelations`, `chatMessagesRelations`) will be added in `server/src/core/db/schema.ts`, and a SQL migration generated and applied to Supabase PostgreSQL.

### 2.2 Shared Contracts (`shared/src/types.ts` & `shared/src/schemas.ts`)

```typescript
export interface CitationDTO {
  index: number;
  badge: string;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  fileType: string;
  similarity: number;
  coordinates: CoordinatesDTO;
  excerpt: string;
}

export interface ChatSessionDTO {
  id: string;
  userId: string;
  documentId: string | null;
  documentTitle: string | null;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageDTO {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: CitationDTO[];
  createdAt: string;
}
```

Zod schemas in `shared/src/schemas.ts`:
- `ragChatRequestSchema`: `{ query: z.string().trim().min(1).max(2000), sessionId: z.string().uuid().optional(), documentId: z.string().uuid().optional() }`
- `chatSessionsQuerySchema`: `paginationSchema` (`page` default 1, `limit` default 20 max 50).

---

## 3. Backend Architecture

### 3.1 Pluggable LLM Streaming Engine (`server/src/features/ai/`)
- **`llm.provider.ts`**:
  ```typescript
  export interface LLMProvider {
    streamCompletion(
      prompt: string,
      onChunk: (text: string) => void,
      signal?: AbortSignal
    ): Promise<string>;
  }
  ```
- **`ollama.llm.ts`**: Streams NDJSON chunks from `${OLLAMA_BASE_URL}/api/generate` with `stream: true` and configurable `OLLAMA_LLM_MODEL` (default `llama3.1:8b`).
- **`gemini.llm.ts`**: Streams via `@google/genai` `ai.models.generateContentStream` using configurable `GEMINI_LLM_MODEL` (default `gemini-2.5-flash`).
- **`provider.factory.ts`**: Reads `unifiedConfig.ai.defaultProvider` dynamically so provider switches take effect without restarting the server.

### 3.2 Grounded RAG & SSE Pipeline (`server/src/features/rag/`)
1. **`context.orchestrator.ts`**:
   - Validates ownership if `sessionId` is supplied (throws 404 if missing or owned by another user) and resolves the locked `documentId`.
   - If `sessionId` is omitted and `documentId` is supplied, verifies the document belongs to `req.user.id`.
   - Fetches the last 6 messages of the session (when resuming) to form the sliding window.
   - Calls Phase 2 `SearchService.search` (`mode: 'hybrid'`, `limit: 6`, scoped to `userId` and optional `documentId`).
   - If 0 chunks are returned, short-circuits before calling the LLM and streams the grounded fallback message: `"The provided documents do not contain information to answer this question."`
2. **`prompt.sanitizer.ts`**:
   - Escapes/strips structural XML-like delimiters (`<document_context>`, `<conversation_history>`, `</...>`) inside user queries and chunk content to prevent prompt injection.
3. **`prompt.builder.ts`**:
   - Formats `<conversation_history>` (last 6 messages) and `<document_context>` with numbered chunks `[1]..[6]` including filename and formatted coordinates.
   - Enforces strict grounding rules: answer exclusively from context, never speculate, cite assertions inline using `[1]`, `[2]`, etc.
4. **`citation.service.ts`**:
   - Builds a lookup map `Map<number, CitationDTO>` from retrieved chunks.
   - Scans streamed text incrementally for `[k]` markers (ignoring out-of-range numbers), deduplicates emitted indices, and returns newly referenced `CitationDTO` objects so `sse.emitter.ts` can emit `event: citation` immediately.
5. **`sse.emitter.ts` & `rag.controller.ts` (`POST /api/v1/chat/rag`)**:
   - Protected by `requireAuth` and `aiLimiter`, validated with `ragChatRequestSchema`.
   - Sets headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
   - Emits typed events:
     - `event: token` -> `{"text": "..."}`
     - `event: citation` -> `CitationDTO`
     - `event: error` -> `{"message": "..."}`
     - `event: done` -> `{"complete": true, "sessionId": "...", "messageId": "..."}`
   - Persists the user message and assistant message (with resolved `citations[]`) to PostgreSQL via `history.service.ts`, and hooks `req.on('close', ...)` to abort the upstream LLM stream if the client disconnects.

### 3.3 Chat History Service & APIs (`server/src/features/chat-history/`)
- **`title.generator.ts`**: Derives a concise 4–6 word session title from the first user prompt.
- **`history.repository.ts` & `history.service.ts`**:
  - `GET /api/v1/chat/sessions`: Paginated sessions for `req.user.id`, joined with `documents.title` and message counts, ordered by `updated_at DESC`.
  - `GET /api/v1/chat/sessions/:id/messages`: Ownership check + chronological messages with verbatim `citations`.
  - `DELETE /api/v1/chat/sessions/:id`: Ownership check + cascading delete of session and messages.

---

## 4. Frontend Architecture (`/chat`, `/chat/:documentId`, `/history`)

### 4.1 State & API Layer (`client/src/features/chat/`)
- **`store/chatStore.ts`** (Zustand): Tracks `activeSessionId`, `scopedDocumentId`, `messages`, `streamingContent`, `streamingCitations`, `isStreaming`, `error`, and `activeCitation` (controlling the Citation Inspector Drawer).
- **`api/chat.api.ts`**:
  - `streamRagChat(payload, handlers, signal)`: Uses `fetch` (`credentials: 'include'`) + `ReadableStream` SSE parser handling partial chunks and typed `token` / `citation` / `error` / `done` events.
  - TanStack Query hooks (`useChatSessions`, `useChatMessages`, `useDeleteChatSession`) with cache invalidation on completion and deletion.

### 4.2 Views & Components
- **`ChatView.tsx`** (`/chat` & `/chat/:documentId`):
  - Top bar with document scope selector (locked for existing session; changing scope starts a new session) and "New Chat" action.
  - Scrollable conversation feed rendering user prompts and assistant responses with inline clickable citation badges (`[Filename · p.4]`) mapped from `[k]` markers.
  - Grounded empty state with suggested starter prompts.
  - Auto-resizing prompt composer with `Enter` to send (`Shift+Enter` for newline) and a Stop button during active streaming.
- **`CitationDrawer.tsx`**:
  - 480px fixed slide-over drawer (`Drawer.tsx` pattern) displaying document title, format badge, similarity percentage, formatted coordinates, and `DOMPurify`-sanitized verbatim `excerpt`.
- **`HistoryView.tsx`** (`/history`):
  - Paginated list of past `ChatSessionDTO` items with title, document scope pill (`All Documents` or `documentTitle`), message count, and relative timestamp.
  - One-click resume navigating to `/chat?sessionId=<id>` (or `/chat/<documentId>?sessionId=<id>`).
  - Delete session button with confirmation dialog and TanStack Query invalidation.

---

## 5. Error Handling & Security

- **Authentication & Isolation**: Every endpoint enforces `requireAuth` and scopes all DB queries by `req.user.id`. Accessing another user's `sessionId` or `documentId` returns HTTP `404`.
- **Prompt Injection**: `prompt.sanitizer.ts` neutralizes delimiter tags in both user input and extracted document chunks before prompt assembly.
- **XSS Prevention**: All citation excerpts and rendered HTML snippets are sanitized with `DOMPurify` on the client.
- **Stream Resilience**: Client disconnect aborts the upstream LLM request via `AbortController`; upstream LLM errors emit `event: error` cleanly without crashing the Express process.

---

## 6. Verification & Testing Plan

- **Shared**: Zod schema unit tests for `ragChatRequestSchema` and `chatSessionsQuerySchema`.
- **Server Unit Tests**: `prompt.sanitizer.test.ts`, `prompt.builder.test.ts`, `citation.service.test.ts`, `title.generator.test.ts`, and `llm.provider.test.ts` (mocked Ollama/Gemini streams).
- **Server Integration Tests**:
  - `rag.api.test.ts`: Supertest SSE tests for `POST /api/v1/chat/rag` (401 unauthenticated, 400 invalid payload, SSE `token`/`citation`/`done` sequence, zero-chunk grounded fallback, cross-user isolation).
  - `history.api.test.ts`: Supertest tests for `GET /api/v1/chat/sessions`, `GET /api/v1/chat/sessions/:id/messages`, and `DELETE /api/v1/chat/sessions/:id` (ownership & cascade).
- **Client Tests**:
  - `ChatView.test.tsx`: SSE streaming render, clickable citation badge opening the 480px `CitationDrawer` with sanitized excerpt, and scope locking.
  - `HistoryView.test.tsx`: Session list rendering, resume navigation, and delete flow.
- **Full Gate**: `npm run typecheck`, `npm run build`, and `npm test` across all workspaces with zero errors.
