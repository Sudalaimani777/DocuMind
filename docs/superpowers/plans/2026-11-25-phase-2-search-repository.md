# Phase 2: Search Repository Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement DocuMind's multi-mode Search Repository Engine (Lexical FTS, Semantic `pgvector` Cosine, and Hybrid RRF) across `shared/`, `server/`, and `client/`, activating `/search` and the global `Cmd/Ctrl + K` Spotlight Palette.

**Architecture:** Modular `ISearchRepository` + service layer in TypeScript (`lexical.service.ts`, `semantic.service.ts`, `hybrid.service.ts`, `rrf.ts`, `snippet.service.ts`, `filter.builder.ts`) wired into Express via `AppDependencies`, paired with a Zustand + TanStack Query + URL-synced `/search` workbench, `SourceChunkDrawer`, and `CommandPalette`.

**Tech Stack:** TypeScript 5.7, Zod 4, Drizzle ORM, Supabase PostgreSQL 16+ (`pgvector` HNSW + GIN `tsvector`), Vitest, Supertest, React 19, Zustand 5, TanStack Query 5, `isomorphic-dompurify` / `dompurify`, Tailwind CSS.

**Spec:** [2026-11-25-phase-2-search-repository-design.md](file:///c:/Users/SudalaimaniKannan/Documents/Codings/Projects/DocuMind/docs/superpowers/specs/2026-11-25-phase-2-search-repository-design.md)

## Global Constraints
- **Zero Docker**: No `Dockerfile`, `docker-compose.yml`, or containerization tooling.
- **No Code Truncation or Placeholders**: Every production and test file must be complete and runnable.
- **User Data Isolation**: Every search query must unconditionally filter by `documents.user_id = :userId` and `documents.status = 'completed'`.
- **DOMPurify Sanitization**: All `ts_headline` HTML snippets must be sanitized with `DOMPurify` (allowing only `<mark>`) on both server and client before rendering.
- **Git Gate**: Per `AGENTS.md`, present changes and ask the developer before running `git commit` or `git push`.

## Review Focus
- `q` containing special PostgreSQL `tsquery` punctuation (e.g., `foo & | ! ( )`) must not throw a SQL syntax error because `websearch_to_tsquery` handles raw user input safely; test special characters in lexical search.
- `startDate` > `endDate` must be rejected with `400 VALIDATION_ERROR` by `searchQuerySchema` before hitting the database.
- `ts_headline` returning embedded `<script>` or `onerror=` attributes from document text must be stripped by `DOMPurify` while preserving `<mark>` tags.
- `hybrid` mode when `AIProvider.generateEmbedding()` rejects must NOT return 500; it must return lexical results with `degraded: true` and `activeMode: 'keyword'`, whereas `semantic` mode must return `503 AI_PROVIDER_UNAVAILABLE`.
- Rapid typing in `/search` or `Cmd/Ctrl + K` must debounce for 300ms before updating URL params or firing `/api/v1/search`.

---

### Task 1: Shared Search Contract (`shared/`)

**Files:**
- Modify: `shared/src/types.ts:60-77`
- Modify: `shared/src/schemas.ts:45-59`
- Test: `shared/tests/schemas.test.ts`

**Interfaces:**
- Consumes: `CoordinatesDTO`, `DocumentFormat` from `shared/src/types.ts`
- Produces: `SearchMode`, `SearchMatchType`, `SearchResultItemDTO`, `SearchResponseDTO`, `searchModeSchema`, `documentFormatSchema`, `searchQuerySchema`, `SearchQueryInput`

- [ ] **Step 1: Write failing tests for `searchQuerySchema` in `shared/tests/schemas.test.ts`**

Append to `shared/tests/schemas.test.ts`:
```ts
import { searchQuerySchema } from '../src/schemas.js';

describe('searchQuerySchema', () => {
  it('applies default mode=hybrid and limit=10', () => {
    const parsed = searchQuerySchema.parse({ q: '  revenue growth  ' });
    expect(parsed.q).toBe('revenue growth');
    expect(parsed.mode).toBe('hybrid');
    expect(parsed.limit).toBe(10);
  });

  it('rejects empty query and query exceeding 300 chars', () => {
    expect(() => searchQuerySchema.parse({ q: '   ' })).toThrow();
    expect(() => searchQuerySchema.parse({ q: 'a'.repeat(301) })).toThrow();
  });

  it('rejects startDate after endDate', () => {
    expect(() =>
      searchQuerySchema.parse({
        q: 'clause',
        startDate: '2026-11-20',
        endDate: '2026-11-10',
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=shared`
Expected: FAIL with `searchQuerySchema` not exported.

- [ ] **Step 3: Add search types to `shared/src/types.ts` and schemas to `shared/src/schemas.ts`**

In `shared/src/types.ts`, add:
```ts
export type SearchMode = 'hybrid' | 'semantic' | 'keyword';
export type SearchMatchType = 'lexical' | 'semantic' | 'hybrid';

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

In `shared/src/schemas.ts`, add:
```ts
export const documentFormatSchema = z.enum(['pdf', 'docx', 'xlsx', 'pptx']);
export const searchModeSchema = z.enum(['hybrid', 'semantic', 'keyword']).default('hybrid');

export const searchQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .min(1, 'Search query is required')
      .max(300, 'Search query must not exceed 300 characters'),
    mode: searchModeSchema,
    format: documentFormatSchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    documentId: z.string().uuid('Invalid documentId UUID').optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
    { message: 'endDate must be on or after startDate', path: ['endDate'] }
  );

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
```

- [ ] **Step 4: Build and test `@documind/shared`**

Run: `npm run build --workspace=shared; npm run typecheck --workspace=shared; npm test --workspace=shared`
Expected: PASS (all tests green, zero type errors).

- [ ] **Step 5: Stage checkpoint (ask developer before committing if committing per-task)**

---

### Task 2: Snippet Sanitizer & Faceted Filter Builder (`server/`)

**Files:**
- Create: `server/src/features/search/snippet.service.ts`
- Create: `server/src/features/search/filter.builder.ts`
- Test: `server/tests/lexical-search.test.ts` (snippet + filter unit tests)

**Interfaces:**
- Consumes: `documents` table from `server/src/core/db/schema.ts`, `DocumentFormat` from `@documind/shared`
- Produces: `sanitizeSnippet(rawHtml: string): string`, `buildFallbackExcerpt(content: string, maxLength?: number): string`, `SearchFilters`, `buildSearchConditions(userId: string, filters: SearchFilters): SQL[]`

- [ ] **Step 1: Install `isomorphic-dompurify` in `server`**

Run: `npm install isomorphic-dompurify --workspace=server`

- [ ] **Step 2: Write failing unit tests for snippet sanitization & filter builder in `server/tests/lexical-search.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { sanitizeSnippet, buildFallbackExcerpt } from '../src/features/search/snippet.service.js';
import { buildSearchConditions } from '../src/features/search/filter.builder.js';

describe('snippet.service', () => {
  it('preserves <mark> tags and strips XSS payloads', () => {
    const dirty = 'Revenue <mark>grew</mark> <img src=x onerror=alert(1)><script>evil()</script> fast';
    expect(sanitizeSnippet(dirty)).toBe('Revenue <mark>grew</mark>  fast');
  });

  it('builds a clean plain-text fallback excerpt', () => {
    const text = 'word '.repeat(60);
    const excerpt = buildFallbackExcerpt(text, 80);
    expect(excerpt.length).toBeLessThanOrEqual(83);
    expect(excerpt.endsWith('...')).toBe(true);
  });
});

describe('filter.builder', () => {
  it('always includes userId and completed status conditions plus optional filters', () => {
    const base = buildSearchConditions('user-1', {});
    expect(base).toHaveLength(2);

    const full = buildSearchConditions('user-1', {
      format: 'pdf',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      documentId: '11111111-1111-4111-8111-111111111111',
    });
    expect(full).toHaveLength(6);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx --workspace=server vitest run tests/lexical-search.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 4: Implement `snippet.service.ts` and `filter.builder.ts`**

`server/src/features/search/snippet.service.ts`:
```ts
import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes PostgreSQL ts_headline HTML, allowing only <mark> highlight tags.
 */
export function sanitizeSnippet(rawHtml: string): string {
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: [],
  }).trim();
}

/**
 * Generates a plain-text excerpt for semantic-only matches without <mark> highlights.
 */
export function buildFallbackExcerpt(content: string, maxLength = 220): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}
```

`server/src/features/search/filter.builder.ts`:
```ts
import { and, eq, gte, lte, type SQL } from 'drizzle-orm';
import type { DocumentFormat } from '@documind/shared';
import { documents } from '../../core/db/schema.js';

export interface SearchFilters {
  format?: DocumentFormat;
  startDate?: Date;
  endDate?: Date;
  documentId?: string;
}

/**
 * Builds mandatory user-isolation and optional faceted filter SQL predicates.
 */
export function buildSearchConditions(userId: string, filters: SearchFilters): SQL[] {
  const conditions: SQL[] = [
    eq(documents.userId, userId),
    eq(documents.status, 'completed'),
  ];

  if (filters.format) {
    conditions.push(eq(documents.fileType, filters.format));
  }
  if (filters.startDate) {
    conditions.push(gte(documents.createdAt, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(documents.createdAt, filters.endDate));
  }
  if (filters.documentId) {
    conditions.push(eq(documents.id, filters.documentId));
  }

  return conditions;
}

export function combineSearchConditions(userId: string, filters: SearchFilters): SQL | undefined {
  return and(...buildSearchConditions(userId, filters));
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx --workspace=server vitest run tests/lexical-search.test.ts`
Expected: PASS.

---

### Task 3: Search Repository, Lexical Service & Semantic Service (`server/`)

**Files:**
- Create: `server/src/features/search/search.repository.ts`
- Create: `server/src/features/search/lexical.service.ts`
- Create: `server/src/features/search/semantic.service.ts`
- Modify: `server/tests/lexical-search.test.ts`
- Create: `server/tests/semantic-search.test.ts`

**Interfaces:**
- Consumes: `db` from `core/db/index.js`, `documentChunks`, `documents` from `core/db/schema.js`, `AIProvider` from `features/ai/ai.provider.js`, `combineSearchConditions` from `filter.builder.js`, `sanitizeSnippet`, `buildFallbackExcerpt` from `snippet.service.js`
- Produces: `RawSearchRow`, `ISearchRepository`, `DrizzleSearchRepository`, `LexicalSearchService`, `SemanticSearchService`

- [ ] **Step 1: Write failing unit tests for `LexicalSearchService` and `SemanticSearchService`**

Add `LexicalSearchService` tests in `server/tests/lexical-search.test.ts` (mocking `ISearchRepository` to verify `sanitizeSnippet`, score mapping, and `matchType: 'lexical'`).
Create `server/tests/semantic-search.test.ts` testing:
- Calls `aiProvider.generateEmbedding(query)` and passes the 768-dim vector to `searchRepo.searchSemantic(...)`.
- Attaches `coordinates`, `matchType: 'semantic'`, and sanitized plain excerpt.
- Propagates error when `aiProvider.generateEmbedding` rejects.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx --workspace=server vitest run tests/lexical-search.test.ts tests/semantic-search.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `search.repository.ts`, `lexical.service.ts`, and `semantic.service.ts`**

`search.repository.ts` defines:
- `RawSearchRow`: `{ chunkId, documentId, documentTitle, originalFilename, fileType, storageUrl, chunkIndex, content, snippetHtml?, coordinates, score }`
- `ISearchRepository`:
  - `searchLexical(userId: string, queryText: string, filters: SearchFilters, limit: number): Promise<RawSearchRow[]>`
  - `searchSemantic(userId: string, queryVector: number[], filters: SearchFilters, limit: number): Promise<RawSearchRow[]>`
- `DrizzleSearchRepository`:
  - `searchLexical`: uses `websearch_to_tsquery('english', ${queryText})`, `ts_rank(...)`, and `ts_headline('english', ${documentChunks.content}, ..., 'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15')`.
  - `searchSemantic`: formats `vectorLiteral = \`[${queryVector.join(',')}]\``, filters `sql\`(1 - (${documentChunks.embedding} <=> ${vectorLiteral}::vector)) > 0.65\``, orders by `sql\`${documentChunks.embedding} <=> ${vectorLiteral}::vector ASC\``.

`lexical.service.ts` maps `RawSearchRow[]` -> `SearchResultItemDTO[]` via `sanitizeSnippet(row.snippetHtml ?? row.content)`, setting `matchType: 'lexical'` and `lexicalScore: row.score`.
`semantic.service.ts` calls `this.aiProvider.generateEmbedding(queryText)` -> `this.repo.searchSemantic(...)` -> maps to `SearchResultItemDTO[]` via `buildFallbackExcerpt(row.content)`, setting `matchType: 'semantic'` and `semanticScore: row.score`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx --workspace=server vitest run tests/lexical-search.test.ts tests/semantic-search.test.ts`
Expected: PASS.

---

### Task 4: Hybrid RRF Merger & Search Orchestrator (`server/`)

**Files:**
- Create: `server/src/features/search/rrf.ts`
- Create: `server/src/features/search/hybrid.service.ts`
- Create: `server/src/features/search/search.service.ts`
- Create: `server/tests/hybrid-search.test.ts`

**Interfaces:**
- Consumes: `LexicalSearchService`, `SemanticSearchService`, `SearchResultItemDTO`, `SearchResponseDTO`, `SearchMode`
- Produces: `mergeWithRrf(lexical: SearchResultItemDTO[], semantic: SearchResultItemDTO[], limit: number, k?: number): SearchResultItemDTO[]`, `HybridSearchService`, `SearchService`

- [ ] **Step 1: Write failing tests in `server/tests/hybrid-search.test.ts`**

Test cases:
1. Chunk appearing at rank 1 in both lexical and semantic receives composite RRF score `2 / (60 + 1)` and outranks single-list matches, with `matchType: 'hybrid'` and the `<mark>` lexical snippet retained.
2. Deduplicates overlapping `chunkId`s.
3. In `hybrid` mode, if `semanticService.search` rejects, `SearchService.search` returns lexical results with `degraded: true` and `activeMode: 'keyword'`.
4. In `semantic` mode, if `semanticService.search` rejects, `SearchService.search` throws `AppError` with `statusCode: 503` and `errorCode: 'AI_PROVIDER_UNAVAILABLE'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx --workspace=server vitest run tests/hybrid-search.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `rrf.ts`, `hybrid.service.ts`, and `search.service.ts`**

Implement `mergeWithRrf` ($k=60$, 1-indexed rank), `HybridSearchService` (`Promise.allSettled([lexical, semantic])`), and `SearchService` (dispatching `keyword` | `semantic` | `hybrid`, measuring `tookMs`).

- [ ] **Step 4: Run tests to verify pass**

Run: `npx --workspace=server vitest run tests/hybrid-search.test.ts`
Expected: PASS.

---

### Task 5: Search HTTP Controller, Routes & Express Wiring (`server/`)

**Files:**
- Create: `server/src/features/search/search.controller.ts`
- Create: `server/src/features/search/search.routes.ts`
- Modify: `server/src/app.ts:28-112`
- Create: `server/tests/search.api.test.ts`

**Interfaces:**
- Consumes: `BaseController`, `requireAuth`, `validate`, `searchQuerySchema`, `SearchService`
- Produces: `SearchController`, `createSearchRouter`, `/api/v1/search` (`GET` and `POST`) mounted in `createApp`

- [ ] **Step 1: Write failing Supertest tests in `server/tests/search.api.test.ts`**

Test cases:
- `GET /api/v1/search?q=test` without auth cookie returns `401`.
- `GET /api/v1/search?q=` returns `400 VALIDATION_ERROR`.
- `GET /api/v1/search?q=revenue&mode=hybrid&format=pdf&limit=5` returns `200` with `{ success: true, data: { query, mode, activeMode, degraded, totalResults, tookMs, results } }`.
- `POST /api/v1/search` with JSON body returns `200`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx --workspace=server vitest run tests/search.api.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `search.controller.ts`, `search.routes.ts`, and wire into `server/src/app.ts`**

`SearchController` extends `BaseController`:
- `searchGet`: reads `res.locals.validated.query as SearchQueryInput` and `req.user!.id`, calls `this.searchService.search(userId, input)`, responds via `this.handleSuccess(res, result)`.
- `searchPost`: reads `res.locals.validated.body as SearchQueryInput` and `req.user!.id`, calls `this.searchService.search(userId, input)`, responds via `this.handleSuccess(res, result)`.
`createSearchRouter(controller)` applies `requireAuth` and `validate({ query: searchQuerySchema })` / `validate({ body: searchQuerySchema })`.
`createApp(deps)` accepts optional `searchService?: SearchService` and mounts `app.use('/api/v1/search', createSearchRouter(searchController))`.

- [ ] **Step 4: Run all server tests & typecheck**

Run: `npm run typecheck --workspace=server; npm test --workspace=server`
Expected: PASS (all server tests and typecheck green).

---

### Task 6: Frontend Search Store, API, URL Sync & Coordinate Formatter (`client/`)

**Files:**
- Create: `client/src/features/search/api/search.api.ts`
- Create: `client/src/features/search/store/searchStore.ts`
- Create: `client/src/features/search/hooks/useSearchSync.ts`
- Create: `client/src/features/search/hooks/useSearchQuery.ts`
- Create: `client/src/features/search/utils/formatCoordinates.ts`

**Interfaces:**
- Consumes: `apiClient` from `client/src/core/api/client`, `SearchMode`, `SearchResponseDTO`, `SearchResultItemDTO`, `CoordinatesDTO`, `DocumentFormat` from `@documind/shared`
- Produces: `executeSearch`, `useSearchStore`, `useSearchSync`, `useSearchQuery`, `formatCoordinates`

- [ ] **Step 1: Install `dompurify` and `@types/dompurify` in `client`**

Run: `npm install dompurify --workspace=client; npm install -D @types/dompurify --workspace=client`

- [ ] **Step 2: Implement `search.api.ts`, `searchStore.ts`, `useSearchSync.ts`, `useSearchQuery.ts`, `formatCoordinates.ts`**

- `search.api.ts`: `executeSearch(params: SearchRequestParams): Promise<SearchResponseDTO>` via `apiClient.get('/v1/search', { params })`.
- `searchStore.ts`: Zustand store holding `query`, `mode`, `format`, `startDate`, `endDate`, `documentId`, `selectedResult`, `isCommandPaletteOpen`, plus setters and `resetFilters`.
- `useSearchSync.ts`: Reads initial URL params (`q`, `mode`, `format`, `startDate`, `endDate`, `documentId`), debounces query edits by 300ms, and updates `useSearchParams` (`replace: true`).
- `useSearchQuery.ts`: TanStack Query `useQuery` with key `['search', debouncedParams]`, `enabled: debouncedQuery.trim().length > 0`, `placeholderData: keepPreviousData`.
- `formatCoordinates.ts`: Formats `CoordinatesDTO` into human-readable labels (`Page 14`, `Sheet: Summary | Rows 14–18`, `Slide 5`, or `Chunk #N`).

- [ ] **Step 3: Run client typecheck**

Run: `npm run typecheck --workspace=client`
Expected: PASS.

---

### Task 7: Frontend SearchView, SourceChunkDrawer, CommandPalette & Tests (`client/`)

**Files:**
- Create: `client/src/features/search/components/SearchResultCard.tsx`
- Create: `client/src/features/search/components/SourceChunkDrawer.tsx`
- Create: `client/src/features/search/views/SearchView.tsx`
- Create: `client/src/components/layout/CommandPalette.tsx`
- Modify: `client/src/components/layout/AppShell.tsx`
- Modify: `client/src/app/routes.tsx`
- Create: `client/tests/SearchView.test.tsx`
- Create: `client/tests/CommandPalette.test.tsx`

**Interfaces:**
- Consumes: `useSearchStore`, `useSearchSync`, `useSearchQuery`, `formatCoordinates`, `FormatBadge`, `DOMPurify`
- Produces: Lazy-loaded `/search` route (`SearchView`), `SourceChunkDrawer`, global `Cmd/Ctrl + K` `CommandPalette`

- [ ] **Step 1: Write failing tests in `client/tests/SearchView.test.tsx` and `client/tests/CommandPalette.test.tsx`**

`SearchView.test.tsx`:
- Renders segmented mode buttons (`Hybrid (RRF)`, `Semantic`, `Keyword`), format filter, and date range inputs.
- Debounces input by 300ms and calls `/api/v1/search`, rendering `<mark>` sanitized with `DOMPurify` (stripping any `<script>`/`onerror`), `FormatBadge`, and coordinate badge.
- Shows degraded-mode banner when `degraded: true`.
- Clicking a result card opens `SourceChunkDrawer` with full `content` and "Open Original File" link.

`CommandPalette.test.tsx`:
- Pressing `Ctrl+K` / `Meta+K` opens the Spotlight Palette dialog.
- Pressing `Enter` on the search input navigates to `/search?q=<query>`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx --workspace=client vitest run tests/SearchView.test.tsx tests/CommandPalette.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `SearchResultCard.tsx`, `SourceChunkDrawer.tsx`, `SearchView.tsx`, `CommandPalette.tsx`, and wire `AppShell.tsx` & `routes.tsx`**

- `SearchResultCard.tsx`: Sanitizes `result.snippet` via `DOMPurify.sanitize(result.snippet, { ALLOWED_TAGS: ['mark'], ALLOWED_ATTR: [] })` and renders with `FormatBadge` and `formatCoordinates(result.coordinates, result.chunkIndex)`.
- `SourceChunkDrawer.tsx`: Slide-over drawer displaying `selectedResult.documentTitle`, `FormatBadge`, coordinate badge, full `selectedResult.content`, score details, and `<a href={selectedResult.storageUrl} target="_blank" rel="noopener noreferrer">Open Original File</a>`.
- `SearchView.tsx`: Full workbench with segmented mode control, faceted filters (`format`, `startDate`, `endDate`, clearable `documentId` pill), degraded notice, loading/empty/error states, and `SourceChunkDrawer`.
- `CommandPalette.tsx`: Global `keydown` listener for `(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'`, debounced quick-search (`limit: 6, mode: 'hybrid'`), `Enter` -> `/search?q=...`, click result -> opens `SourceChunkDrawer`.
- `AppShell.tsx`: Mount `<CommandPalette />` and wire top-bar search input / shortcut hint.
- `routes.tsx`: Lazy-load `SearchView` at `/search`.

- [ ] **Step 4: Run full workspace verification**

Run:
```powershell
npm run typecheck --workspace=shared; npm run typecheck --workspace=server; npm run typecheck --workspace=client; npm test
```
Expected: All typechecks and tests PASS with exit code 0.

- [ ] **Step 5: Update `docs/phase/PHASE_2_SEARCH_REPOSITORY.md` checkboxes & status, then present changes to developer for commit approval**
