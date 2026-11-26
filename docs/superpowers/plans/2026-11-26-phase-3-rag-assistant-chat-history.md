# Phase 3: Grounded AI Assistant & Chat History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement DocuMind's Grounded AI RAG Assistant and Persistent Chat History across `shared/`, `server/`, and `client/`, activating `/chat`, `/chat/:documentId`, and `/history`.

**Architecture:** Modular RAG pipeline (`context.orchestrator.ts`, `prompt.sanitizer.ts`, `prompt.builder.ts`, `citation.service.ts`, `sse.emitter.ts`) backed by pluggable streaming `LLMProvider` adapters (Ollama & Gemini) and Drizzle PostgreSQL `chat_sessions`/`chat_messages` repositories wired into Express via `AppDependencies`, paired with a Zustand + `ReadableStream` SSE + TanStack Query frontend (`/chat`, `/chat/:documentId`, `CitationDrawer`, `/history`).

**Tech Stack:** TypeScript 5.7, Zod 4, Drizzle ORM, Supabase PostgreSQL 16+, `@google/genai`, Ollama HTTP streaming, Express 5, Vitest, Supertest, React 19, Zustand 5, TanStack Query 5, `dompurify`, Tailwind CSS.

**Spec:** [2026-11-26-phase-3-rag-assistant-design.md](file:///c:/Users/SudalaimaniKannan/Documents/Codings/Projects/DocuMind/docs/superpowers/specs/2026-11-26-phase-3-rag-assistant-design.md)

## Global Constraints
- **Zero Docker**: No `Dockerfile`, `docker-compose.yml`, or containerization tooling.
- **No Code Truncation or Placeholders**: Every production and test file must be complete and runnable.
- **User Data Isolation**: Every session, message, and document lookup must unconditionally filter by `userId = req.user.id`. Accessing another user's session or document returns HTTP `404`.
- **Strict Grounding & Prompt Injection Defense**: Neutralize XML-like delimiter tags in user queries and document chunks; instruct the LLM to cite `[1]..[N]` and refuse unsupported claims.
- **DOMPurify Sanitization**: Sanitize citation excerpts rendered in `CitationDrawer` with `DOMPurify`.
- **Git Gate**: Per `AGENTS.md`, present changes and ask the developer before running `git commit` or `git push`.

## Review Focus
- User query or chunk text containing `<document_context>`, `</document_context>`, or `<conversation_history>` injection tags must be escaped by `prompt.sanitizer.ts` so it cannot break prompt boundaries.
- Out-of-range or malformed citation markers (e.g., `[99]`, `[0]`, `[abc]`) emitted by an LLM must be ignored by `citation.service.ts` rather than crashing or emitting invalid `CitationDTO`s.
- Zero matching chunks from `SearchService.search` must short-circuit before calling `LLMProvider.streamCompletion`, streaming the grounded fallback message and persisting both turns cleanly.
- Client disconnect (`req.on('close')`) during SSE streaming must abort the upstream `AbortController` signal without unhandled promise rejections.
- Accessing or deleting another user's `sessionId` via `/api/v1/chat/rag` or `/api/v1/chat/sessions/:id` must return `404` and never leak messages or mutate state.

---

### Task 1: Shared Chat & Citation Contracts (`shared/`)

**Files:**
- Modify: `shared/src/types.ts:100-108`
- Modify: `shared/src/schemas.ts:75-83`
- Test: `shared/tests/schemas.test.ts`

**Interfaces:**
- Consumes: `CoordinatesDTO`, `paginationSchema` from `shared/src/`
- Produces: `CitationDTO`, `ChatSessionDTO`, `ChatMessageDTO`, `ChatRole`, `RagChatRequestInput`, `ragChatRequestSchema`, `chatSessionsQuerySchema`

- [ ] **Step 1: Write failing tests in `shared/tests/schemas.test.ts`**

```ts
import { ragChatRequestSchema, chatSessionsQuerySchema } from '../src/schemas.js';

describe('ragChatRequestSchema', () => {
  it('trims valid query and accepts optional sessionId and documentId UUIDs', () => {
    const parsed = ragChatRequestSchema.parse({
      query: '  What was Q3 operating income?  ',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(parsed.query).toBe('What was Q3 operating income?');
    expect(parsed.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('rejects empty query, query > 2000 chars, and invalid UUIDs', () => {
    expect(() => ragChatRequestSchema.parse({ query: '   ' })).toThrow();
    expect(() => ragChatRequestSchema.parse({ query: 'x'.repeat(2001) })).toThrow();
    expect(() =>
      ragChatRequestSchema.parse({ query: 'hi', sessionId: 'not-a-uuid' })
    ).toThrow();
  });
});

describe('chatSessionsQuerySchema', () => {
  it('defaults page=1 and limit=20', () => {
    expect(chatSessionsQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=shared`
Expected: FAIL with `ragChatRequestSchema` not exported.

- [ ] **Step 3: Add DTOs to `shared/src/types.ts` and schemas to `shared/src/schemas.ts`**

Append to `shared/src/types.ts`:
```ts
export type ChatRole = 'user' | 'assistant';

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
  role: ChatRole;
  content: string;
  citations: CitationDTO[];
  createdAt: string;
}
```

Append to `shared/src/schemas.ts`:
```ts
export const ragChatRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, 'Query is required')
    .max(2000, 'Query must not exceed 2000 characters'),
  sessionId: z.string().uuid('Invalid sessionId UUID').optional(),
  documentId: z.string().uuid('Invalid documentId UUID').optional(),
});

export const chatSessionsQuerySchema = paginationSchema;

export type RagChatRequestInput = z.infer<typeof ragChatRequestSchema>;
export type ChatSessionsQueryInput = z.infer<typeof chatSessionsQuerySchema>;
```

- [ ] **Step 4: Build and test `shared`**

Run: `npm run build --workspace=shared && npm test --workspace=shared`
Expected: PASS (all shared tests green, `.d.ts` emitted).

---

### Task 2: Database Schema & Migration (`chat_sessions`, `chat_messages`)

**Files:**
- Modify: `server/src/core/db/schema.ts:1-134`
- Test: `server/tests/db.test.ts`

**Interfaces:**
- Consumes: `CitationDTO` from `@documind/shared`, `users`, `documents` in `server/src/core/db/schema.ts`
- Produces: `chatSessions`, `chatMessages`, `chatSessionsRelations`, `chatMessagesRelations`

- [ ] **Step 1: Add schema assertion to `server/tests/db.test.ts`**

Verify `chatSessions` and `chatMessages` table definitions and columns (`userId`, `documentId`, `sessionId`, `citations`) exist in `schema.ts`.

- [ ] **Step 2: Run `npm test --workspace=server -- tests/db.test.ts` to verify it fails**

Expected: FAIL with `chatSessions` / `chatMessages` not exported.

- [ ] **Step 3: Update `server/src/core/db/schema.ts`**

Add `chatSessions` and `chatMessages` tables, indexes (`idx_chat_sessions_user_id`, `idx_chat_messages_session_id`), and Drizzle relations (`usersRelations`, `documentsRelations`, `chatSessionsRelations`, `chatMessagesRelations`).

- [ ] **Step 4: Generate & apply migration, then run `db.test.ts`**

Run: `npm run db:generate --workspace=server && npm run db:migrate --workspace=server && npm test --workspace=server -- tests/db.test.ts`
Expected: PASS.

---

### Task 3: Pluggable Streaming LLM Engine (`server/src/features/ai/`)

**Files:**
- Modify: `server/src/core/config/unifiedConfig.ts` (add `OLLAMA_LLM_MODEL` default `'llama3.1:8b'` and `GEMINI_LLM_MODEL` default `'gemini-2.5-flash'`)
- Create: `server/src/features/ai/llm.provider.ts`
- Create: `server/src/features/ai/ollama.llm.ts`
- Create: `server/src/features/ai/gemini.llm.ts`
- Create: `server/src/features/ai/provider.factory.ts`
- Test: `server/tests/llm.provider.test.ts`

**Interfaces:**
- Consumes: `unifiedConfig` from `server/src/core/config/unifiedConfig.js`
- Produces: `LLMProvider` interface, `OllamaLLMProvider`, `GeminiLLMProvider`, `createLLMProvider(provider?)`

- [ ] **Step 1: Write failing tests in `server/tests/llm.provider.test.ts`**

Test:
1. `OllamaLLMProvider.streamCompletion` parses NDJSON stream lines (`{"response":"Hello","done":false}`), invokes `onChunk` per token, returns full concatenated text, and forwards `AbortSignal` to `fetch`.
2. `GeminiLLMProvider.streamCompletion` iterates `generateContentStream`, invokes `onChunk` per chunk, and returns full text.
3. `createLLMProvider('ollama')` and `createLLMProvider('gemini')` return the expected adapter instances.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=server -- tests/llm.provider.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `llm.provider.ts`, `ollama.llm.ts`, `gemini.llm.ts`, `provider.factory.ts`, and `unifiedConfig.ts` model fields**

- `ollama.llm.ts`: `POST ${ollamaBaseUrl}/api/generate` with `{ model, prompt, stream: true }`, reading `response.body.getReader()` line-by-line.
- `gemini.llm.ts`: Uses `@google/genai` `GoogleGenAI({ apiKey })` and `ai.models.generateContentStream({ model, contents: prompt })`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test --workspace=server -- tests/llm.provider.test.ts`
Expected: PASS.

---

### Task 4: Prompt Sanitizer, Prompt Builder & Citation Extractor (`server/src/features/rag/`)

**Files:**
- Create: `server/src/features/rag/prompt.sanitizer.ts`
- Create: `server/src/features/rag/prompt.builder.ts`
- Create: `server/src/features/rag/citation.service.ts`
- Test: `server/tests/rag.unit.test.ts`

**Interfaces:**
- Consumes: `SearchResultItemDTO`, `CitationDTO`, `ChatMessageDTO` from `@documind/shared`
- Produces:
  - `sanitizePromptInput(input: string): string`
  - `buildGroundedPrompt(params: { query: string; chunks: SearchResultItemDTO[]; history: Array<{ role: 'user' | 'assistant'; content: string }> }): string`
  - `CitationTracker` class with `processDelta(delta: string): CitationDTO[]` and `getEmittedCitations(): CitationDTO[]`

- [ ] **Step 1: Write failing tests in `server/tests/rag.unit.test.ts`**

Include tests for:
1. `sanitizePromptInput`: escapes `<document_context>`, `</document_context>`, `<conversation_history>`, `</conversation_history>` (case-insensitive) so injected tags cannot close prompt sections.
2. `buildGroundedPrompt`: numbers chunks `[1]..[N]`, includes filename + formatted coordinates, includes sliding-window history, and enforces strict grounding instructions.
3. `CitationTracker`: buffers partial bracket markers across token deltas (e.g., `"["` + `"1]"`), emits `CitationDTO` once per valid index `1..N`, and ignores out-of-range (`[0]`, `[99]`) or non-numeric (`[abc]`) markers.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=server -- tests/rag.unit.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `prompt.sanitizer.ts`, `prompt.builder.ts`, and `citation.service.ts`**

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test --workspace=server -- tests/rag.unit.test.ts`
Expected: PASS.

---

### Task 5: Chat History Repository, Title Generator & Service (`server/src/features/chat-history/`)

**Files:**
- Create: `server/src/features/chat-history/title.generator.ts`
- Create: `server/src/features/chat-history/history.repository.ts`
- Create: `server/src/features/chat-history/history.service.ts`
- Test: `server/tests/history.service.test.ts`

**Interfaces:**
- Consumes: `chatSessions`, `chatMessages`, `documents` from `server/src/core/db/schema.js`; `ChatSessionDTO`, `ChatMessageDTO`, `CitationDTO` from `@documind/shared`
- Produces:
  - `generateSessionTitle(query: string): string`
  - `IChatHistoryRepository`, `DrizzleChatHistoryRepository`
  - `ChatHistoryService` (`listSessions`, `getSessionMessages`, `deleteSession`, `getOwnedSession`, `createSession`, `appendExchange`, `getRecentHistory`)

- [ ] **Step 1: Write failing tests in `server/tests/history.service.test.ts`**

Test:
1. `generateSessionTitle`: strips punctuation/extra whitespace and caps at 6 words (with fallback `"New Document Chat"`).
2. `getSessionMessages` / `deleteSession`: throws `AppError(404)` when session does not exist or belongs to a different `userId`.
3. `getRecentHistory`: returns at most the last 6 messages in chronological order.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=server -- tests/history.service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `title.generator.ts`, `history.repository.ts`, and `history.service.ts`**

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test --workspace=server -- tests/history.service.test.ts`
Expected: PASS.

---

### Task 6: RAG Context Orchestrator, SSE Emitter & Controllers (`server/src/features/rag/` & `chat-history/`)

**Files:**
- Create: `server/src/features/rag/context.orchestrator.ts`
- Create: `server/src/features/rag/sse.emitter.ts`
- Create: `server/src/features/rag/rag.controller.ts`
- Create: `server/src/features/rag/rag.routes.ts`
- Create: `server/src/features/chat-history/history.controller.ts`
- Create: `server/src/features/chat-history/history.routes.ts`
- Modify: `server/src/app.ts` (add optional `ragController` / `historyService` to `AppDependencies` and mount `/api/v1/chat`)
- Test: `server/tests/rag.api.test.ts`, `server/tests/history.api.test.ts`

**Interfaces:**
- Consumes: `SearchService`, `ChatHistoryService`, `createLLMProvider`, `buildGroundedPrompt`, `CitationTracker`, `requireAuth`, `aiLimiter`, `ragChatRequestSchema`, `chatSessionsQuerySchema`, `uuidParamSchema`
- Produces:
  - `POST /api/v1/chat/rag` (SSE stream: `token`, `citation`, `error`, `done`)
  - `GET /api/v1/chat/sessions`
  - `GET /api/v1/chat/sessions/:id/messages`
  - `DELETE /api/v1/chat/sessions/:id`

- [ ] **Step 1: Write failing Supertest integration tests in `server/tests/rag.api.test.ts` and `server/tests/history.api.test.ts`**

Test:
- `POST /api/v1/chat/rag`: 401 when unauthenticated; 400 on empty query; 404 when `sessionId` belongs to another user; SSE `token` + `citation` + `done` events when chunks match; grounded fallback without calling LLM when 0 chunks match.
- `/api/v1/chat/sessions`: list pagination, get messages in order, delete session cascade, 404 cross-user isolation.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace=server -- tests/rag.api.test.ts tests/history.api.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `context.orchestrator.ts`, `sse.emitter.ts`, `rag.controller.ts`, `rag.routes.ts`, `history.controller.ts`, `history.routes.ts`, and wire into `server/src/app.ts`**

- [ ] **Step 4: Run server tests and typecheck**

Run: `npm run typecheck --workspace=server && npm test --workspace=server`
Expected: PASS.

---

### Task 7: Client Chat Store & SSE/History API Layer (`client/src/features/chat/`)

**Files:**
- Create: `client/src/features/chat/store/chatStore.ts`
- Create: `client/src/features/chat/api/chat.api.ts`
- Create: `client/src/features/chat/hooks/useChatHistory.ts`
- Test: `client/tests/chatStore.test.ts`

**Interfaces:**
- Consumes: `ChatMessageDTO`, `ChatSessionDTO`, `CitationDTO`, `RagChatRequestInput` from `@documind/shared`; `apiClient` from `client/src/core/api/client.ts`
- Produces: `useChatStore`, `streamRagChat`, `useChatSessions`, `useChatMessages`, `useDeleteChatSession`

- [ ] **Step 1: Write failing unit tests in `client/tests/chatStore.test.ts`**

Test state transitions: `startStream`, `appendToken`, `addCitation` (deduped by `index`), `finishStream`, `setActiveCitation`, `resetForScope`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=client -- tests/chatStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `chatStore.ts`, `chat.api.ts` (`fetch` + `ReadableStream` SSE parser), and `useChatHistory.ts`**

- [ ] **Step 4: Run test to verify pass**

Run: `npm test --workspace=client -- tests/chatStore.test.ts`
Expected: PASS.

---

### Task 8: Citation Inspector Drawer & Chat View (`/chat`, `/chat/:documentId`)

**Files:**
- Create: `client/src/features/chat/components/CitationDrawer.tsx`
- Create: `client/src/features/chat/components/ChatMessageBubble.tsx`
- Create: `client/src/features/chat/components/ChatComposer.tsx`
- Create: `client/src/features/chat/views/ChatView.tsx`
- Modify: `client/src/app/routes.tsx` (lazy-load `ChatView` for `/chat` and `/chat/:documentId`)
- Test: `client/tests/ChatView.test.tsx`

**Interfaces:**
- Consumes: `useChatStore`, `streamRagChat`, `useChatMessages`, `Drawer` (`client/src/components/layout/Drawer.tsx`), `DOMPurify`, `formatCoordinates` (`client/src/core/lib/formatCoordinates.ts`), `useDocuments`
- Produces: `ChatView`, `CitationDrawer`

- [ ] **Step 1: Write failing tests in `client/tests/ChatView.test.tsx`**

Test:
1. Submits a prompt, consumes mocked SSE `token` + `citation` + `done` events, and renders the streamed answer with clickable citation badge.
2. Clicking the citation badge opens the 480px `CitationDrawer` displaying document title, coordinates, similarity, and `DOMPurify`-sanitized verbatim excerpt (verifying `<script>`/`onerror` stripping).
3. Changing document scope resets the active session.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=client -- tests/ChatView.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `CitationDrawer.tsx`, `ChatMessageBubble.tsx`, `ChatComposer.tsx`, `ChatView.tsx`, and wire `/chat` + `/chat/:documentId` in `routes.tsx`**

- [ ] **Step 4: Run test to verify pass**

Run: `npm test --workspace=client -- tests/ChatView.test.tsx`
Expected: PASS.

---

### Task 9: Chat History View (`/history`)

**Files:**
- Create: `client/src/features/chat-history/views/HistoryView.tsx`
- Modify: `client/src/app/routes.tsx` (lazy-load `HistoryView` for `/history`)
- Test: `client/tests/HistoryView.test.tsx`

**Interfaces:**
- Consumes: `useChatSessions`, `useDeleteChatSession`, `ChatSessionDTO`
- Produces: `HistoryView`

- [ ] **Step 1: Write failing tests in `client/tests/HistoryView.test.tsx`**

Test:
1. Renders session list with title, document scope badge, message count, and timestamp.
2. Clicking "Resume" navigates to `/chat?sessionId=<id>` (or `/chat/<documentId>?sessionId=<id>`).
3. Confirming delete calls `DELETE /api/v1/chat/sessions/:id` and updates the list.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=client -- tests/HistoryView.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `HistoryView.tsx` and wire `/history` in `routes.tsx`**

- [ ] **Step 4: Run test to verify pass**

Run: `npm test --workspace=client -- tests/HistoryView.test.tsx`
Expected: PASS.

---

### Task 10: Final Monorepo Verification & Phase Tracker Sync

**Files:**
- Modify: `docs/phase/PHASE_3_RAG_ASSISTANT_CHAT_HISTORY.md`
- Modify: `docs/phase/README.md`

- [ ] **Step 1: Run full monorepo typecheck, build, and test suite**

Run: `npm run typecheck; if ($LASTEXITCODE -eq 0) { npm run build }; if ($LASTEXITCODE -eq 0) { npm test }`
Expected: Exit code `0` across `shared`, `server`, and `client`.

- [ ] **Step 2: Verify zero Docker files exist and update `docs/phase/` status**

- [ ] **Step 3: Present summary of all changes to the developer and ask for commit/push approval (per `AGENTS.md`)**
