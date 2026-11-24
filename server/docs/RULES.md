# Server Engineering Rules & Development Protocols — DocuMind

> **Target Scope**: `server/`  
> **Audience**: Backend Engineers & Autonomous Coding Agents  
> **Status**: Mandatory Enforcement

---

## 1. Prime Server Directives

1. **ZERO DOCKER**:
   * Do **NOT** create Dockerfiles or docker-compose files.
   * Connect natively to local or managed PostgreSQL with `pgvector`, Redis, and Cloudinary.
2. **NO TRUNCATION OR PLACEHOLDERS**:
   * Production files must never contain `// TODO: implement later` or `/* rest of code */`. Deliver fully runnable, tested TypeScript code.
3. **FEATURE SCOPE BOUNDARIES**:
   * Features 5 (One-click batch operations) and 6 (Document-to-document visual diff/comparison) were **explicitly removed from scope**. Do not implement them.

---

## 2. Layering & Architectural Discipline

* **Controllers (`src/features/*/controller.ts`)**:
  * Extract and validate request inputs via **Zod**.
  * Delegate immediately to service layer.
  * Return appropriate HTTP status codes (`200`, `202`, `400`, `404`, `409`, `429`).
  * **Strictly Forbidden**: No direct SQL queries, Drizzle calls, or business calculations inside controllers.
* **Services (`src/features/*/service.ts`)**:
  * Contain business logic, deduplication checks, queue dispatching, and coordination.
  * Must be stateless and independently unit testable.
* **Data Access (`src/db/`)**:
  * All database operations must pass through **Drizzle ORM**.
  * Use native `pgvector` operators (`<=>`). Raw SQL strings are permitted only for complex HNSW index query expressions.
* **Queue Workers (`src/workers/`)**:
  * Heavy operations (parsing, chunking, embedding) must **never run synchronously** inside an Express request handler.
  * Always dispatch a BullMQ job and return `202 Accepted` immediately.

---

## 3. Ingestion & Security Rules

* **Magic Bytes Check**: Always inspect binary magic bytes using `file-type` on in-memory buffers before passing them to parsers. Never trust user-supplied `Content-Type` headers or file extensions.
* **Buffer Size Limit**: Enforce a hard **25MB buffer size limit** in `Multer`.
* **Deduplication Check**: Compute `SHA-256` hash immediately on receipt. Reject identical files with HTTP `409 Conflict`.
* **Path Traversal Defense**: Never write user filenames to local disk or cloud paths. Always generate random `UUIDv4` identifiers for Cloudinary assets.
* **AI Provider Safety**: Maintain uniform **768 dimensions** across all embedding providers (Ollama `nomic-embed-text` and Gemini `text-embedding-004`).

---

## 4. Error Handling Protocol

* Always use typed operational errors extending `AppError`:
  * `BadRequestError` (400)
  * `UnauthorizedError` (401)
  * `NotFoundError` (404)
  * `ConflictError` (409)
* Catch asynchronous errors in controllers and pass to `next(err)`.
* Centralized error middleware formats errors into the standard JSON envelope and strips internal stack traces in production.

---

## 5. Verification Checklist

Before declaring any backend task or milestone complete:
1. Run typecheck: `pnpm --filter server tsc --noEmit`
2. Run test suites: `pnpm --filter server test`
3. Verify zero Docker artifacts were created.
4. Verify all endpoints are documented in `server/docs/API.md`.
