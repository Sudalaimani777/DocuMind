# Phase 2 Design Spec: Search Repository Engine

> **Date**: 2026-11-25  
> **Branch**: `feat/phase-2-search-repository`  
> **Status**: Draft — Pending User Review  
> **Reference**: [PHASE_2_SEARCH_REPOSITORY.md](file:///c:/Users/SudalaimaniKannan/Documents/Codings/Projects/DocuMind/docs/phase/PHASE_2_SEARCH_REPOSITORY.md)

---

## 1. Objective & Scope

Build the **Search Repository Engine** for DocuMind, activating `/search` and a global `Cmd/Ctrl + K` Spotlight Palette. Users can query their own completed documents using three retrieval modes—**Keyword (Lexical FTS)**, **Semantic (`pgvector` Cosine)**, and **Hybrid (Reciprocal Rank Fusion)**—with faceted filtering (`format`, `startDate`/`endDate`, `documentId`), sanitized `<mark>` highlight snippets, exact source coordinates, and a Source Chunk Preview Drawer.

### Key Design Decisions
- **Approach**: Modular repository + service layer in TypeScript (`ISearchRepository` + `DrizzleSearchRepository`) with concurrent lexical/semantic queries and in-app RRF ($k=60$).
- **Filters**: `format`, `startDate`/`endDate`, and `documentId` are all supported in `searchQuerySchema` and the API; `/search` exposes `format` and date range controls plus a clearable `documentId` scope chip when deep-linked.
- **AI Provider Resilience**: In `hybrid` mode, if `AIProvider.generateEmbedding()` fails or times out, the engine degrades gracefully to lexical results (`degraded: true`, `activeMode: 'keyword'`). In `semantic` mode, provider failure returns `503 Service Unavailable`.
- **Result Interaction**: Clicking a search result card (on `/search` or in `Cmd+K`) opens `SourceChunkDrawer` with full chunk text, document metadata, coordinate badge, and an "Open Original File" link (`storageUrl`). Pressing `Enter` on the query in `Cmd+K` navigates to `/search?q=<query>`.

---

## 2. Shared Contract (`shared/`)

### 2.1 Zod Schemas (`shared/src/schemas.ts`)
- `searchModeSchema`: `z.enum(['hybrid', 'semantic', 'keyword']).default('hybrid')`
- `documentFormatSchema`: `z.enum(['pdf', 'docx', 'xlsx', 'pptx'])`
- `searchQuerySchema`:
  - `q`: `z.string().trim().min(1, 'Search query is required').max(300, 'Search query must not exceed 300 characters')`
  - `mode`: `searchModeSchema`
  - `format`: `documentFormatSchema.optional()`
  - `startDate`: `z.coerce.date().optional()`
  - `endDate`: `z.coerce.date().optional()`
  - `documentId`: `z.string().uuid('Invalid documentId UUID').optional()`
  - `limit`: `z.coerce.number().int().min(1).max(50).default(10)`
  - Refinement: if both `startDate` and `endDate` are provided, `endDate >= startDate`.

### 2.2 DTOs (`shared/src/types.ts`)
- `SearchMode = 'hybrid' | 'semantic' | 'keyword'`
- `SearchMatchType = 'lexical' | 'semantic' | 'hybrid'`
- `SearchResultItemDTO`:
  ```ts
  export interface SearchResultItemDTO {
    chunkId: string;
    documentId: string;
    documentTitle: string;
    originalFilename: string;
    fileType: DocumentFormat;
    storageUrl: string;
    chunkIndex: number;
    content: string;
    snippet: string;
    coordinates: CoordinatesDTO;
    score: number;
    lexicalScore?: number;
    semanticScore?: number;
    matchType: SearchMatchType;
  }
  ```
- `SearchResponseDTO`:
  ```ts
  export interface SearchResponseDTO {
    query: string;
    mode: SearchMode;
    activeMode: SearchMode;
    degraded: boolean;
    totalResults: number;
    tookMs: number;
    results: SearchResultItemDTO[];
  }
  ```

---

## 3. Backend Architecture (`server/src/features/search/`)

### 3.1 File Layout
- `filter.builder.ts` — Composes Drizzle `SQL[]` predicates (`documents.userId = userId`, `documents.status = 'completed'`, optional `fileType`, `createdAt >= startDate`, `createdAt <= endDate`, `documentId`).
- `search.repository.ts` — `ISearchRepository` interface & `DrizzleSearchRepository` implementation:
  - `searchLexical(userId, queryText, filters, limit)`:
    - `INNER JOIN documents ON document_chunks.document_id = documents.id`
    - `to_tsvector('english', document_chunks.content) @@ websearch_to_tsquery('english', :queryText)`
    - `ts_rank(to_tsvector('english', document_chunks.content), websearch_to_tsquery('english', :queryText))`
    - `ts_headline('english', document_chunks.content, websearch_to_tsquery('english', :queryText), 'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15')`
    - Ordered by rank `DESC`, limited to `limit`.
  - `searchSemantic(userId, queryVector, filters, limit)`:
    - `INNER JOIN documents ON document_chunks.document_id = documents.id`
    - Similarity expression: `1 - (document_chunks.embedding <=> :vectorLiteral)`
    - Filter: `(1 - (document_chunks.embedding <=> :vectorLiteral)) > 0.65`
    - Ordered by `document_chunks.embedding <=> :vectorLiteral ASC` (uses HNSW index `idx_chunks_embedding_hnsw`), limited to `limit`.
- `snippet.service.ts`:
  - `sanitizeSnippet(rawHtml)`: Uses `DOMPurify` (`isomorphic-dompurify`) allowing only `['mark']` tags and zero attributes, stripping any potentially unsafe HTML.
  - `buildFallbackExcerpt(content, maxLength = 220)`: Generates clean plain-text excerpt for semantic-only matches.
- `lexical.service.ts` — Calls `searchLexical` and sanitizes every `ts_headline` via `snippet.service.ts`.
- `semantic.service.ts` — Vectorizes `q` via `AIProvider.generateEmbedding(q)` (768-dim), calls `searchSemantic`, and formats fallback excerpts + `CoordinatesDTO`.
- `rrf.ts` — Pure `mergeWithRrf(lexical, semantic, limit, k = 60)`:
  - Computes $RRF(d) = \sum_{m \in \{lex, sem\}} \frac{1}{60 + rank_m(d)}$ (1-indexed ranks).
  - Deduplicates by `chunkId`.
  - When a chunk appears in both lists, marks `matchType: 'hybrid'`, retains both `lexicalScore` and `semanticScore`, and prefers the `<mark>`-highlighted lexical snippet.
- `hybrid.service.ts` — Runs `lexicalService.search(...)` and `semanticService.search(...)` concurrently via `Promise.allSettled`:
  - If both succeed: merges via `mergeWithRrf` (`degraded: false, activeMode: 'hybrid'`).
  - If semantic fails and lexical succeeds: logs warning and returns lexical results (`degraded: true, activeMode: 'keyword'`).
  - If lexical fails: propagates database error (`500`).
- `search.service.ts` — Routes `mode` (`keyword` | `semantic` | `hybrid`), measures `tookMs`, and maps `semantic` `AIProvider` failures to `AppError(503, 'AI_PROVIDER_UNAVAILABLE', ...)`.
- `search.controller.ts` & `search.routes.ts`:
  - `GET /api/v1/search` (validates `req.query` via `searchQuerySchema`)
  - `POST /api/v1/search` (validates `req.body` via `searchQuerySchema`)
  - Enforces `requireAuth` middleware and injects `req.user.id`.
  - Wired into `server/src/app.ts` via `AppDependencies` (`searchService?`).

### 3.2 Data Isolation & Security
- Every SQL query unconditionally enforces `documents.user_id = :userId` and `documents.status = 'completed'`.
- All `ts_headline` HTML is sanitized server-side in `snippet.service.ts` **and** client-side with `DOMPurify` before rendering.
- All query/body inputs are validated with Zod before reaching services.

---

## 4. Frontend Architecture (`client/src/`)

### 4.1 Search Feature (`client/src/features/search/`)
- `api/search.api.ts` — `executeSearch(params)` calling `GET /api/v1/search`.
- `store/searchStore.ts` — Zustand store for `query`, `mode`, `format`, `startDate`, `endDate`, `documentId`, `selectedResult`, `isCommandPaletteOpen`, and reset actions.
- `hooks/useSearchSync.ts` — Bidirectional synchronization between `useSearchParams` (`?q=&mode=&format=&startDate=&endDate=&documentId=`) and `useSearchStore` with **300ms debouncing** on query input.
- `hooks/useSearchQuery.ts` — TanStack Query (`['search', params]`, enabled when `q.trim().length > 0`).
- `utils/formatCoordinates.ts` — Formats `CoordinatesDTO` into readable badges (`Page 14`, `Sheet: Summary | Rows 14–18`, `Slide 5`).
- `components/SearchResultCard.tsx` — Displays `FormatBadge`, document title, coordinate badge, match type/score pill, and `DOMPurify`-sanitized `<mark>` snippet.
- `components/SourceChunkDrawer.tsx` — Slide-over drawer showing full `content`, document metadata, coordinate badge, score breakdown, and "Open Original File" (`storageUrl`) link.
- `views/SearchView.tsx` — Search bar, segmented mode control (`Hybrid (RRF)`, `Semantic`, `Keyword`), faceted filters (`format`, `startDate`/`endDate`, clearable `documentId` chip), degraded-mode banner, result list, and empty/error states.

### 4.2 Routing & Global Shell
- `client/src/app/routes.tsx` — Replace the `/search` `PhaseRoutePlaceholder` with lazy-loaded `SearchView`.
- `client/src/components/layout/CommandPalette.tsx` — Global `Cmd/Ctrl + K` dialog mounted in `AppShell.tsx` (also triggered from the top-bar search input):
  - Debounced quick-search (`limit: 6`, `mode: 'hybrid'`).
  - Keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`/`Escape`).
  - Pressing `Enter` on the query navigates to `/search?q=<query>`; clicking/selecting a result opens `SourceChunkDrawer`.

---

## 5. Verification & Testing Plan

### Backend (`server/tests/`)
- `lexical-search.test.ts` — Stemming, boolean operators, `DOMPurify` `<mark>` sanitization, strict user isolation.
- `semantic-search.test.ts` — Query vectorization, `> 0.65` similarity threshold, `503` on provider failure, coordinate attachment.
- `hybrid-search.test.ts` — RRF $k=60$ ranking, chunk deduplication, graceful degradation to `keyword` on provider failure.
- `search.api.test.ts` — Supertest: `401` unauthenticated, `400` invalid `q`/`limit`/`date`, `GET` & `POST` multi-mode responses.

### Frontend (`client/tests/`)
- `SearchView.test.tsx` — Mode switching, 300ms debounced URL sync, `DOMPurify` `<mark>` rendering, coordinate badges, degraded banner, and `SourceChunkDrawer` interaction.
- `CommandPalette.test.tsx` — `Cmd/Ctrl + K` shortcut toggle, `Enter` navigation to `/search?q=...`, and result selection.

### Exit Verification
- `npm run typecheck --workspace=shared`, `npm run typecheck --workspace=server`, `npm run typecheck --workspace=client`
- `npm test` across all workspaces
- Zero Docker configs introduced
