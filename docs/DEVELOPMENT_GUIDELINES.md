# Development Guidelines & Engineering Standards — DocuMind

> **Status**: Production Engineering Standard  
> **Audience**: All human engineers and AI agents contributing to the DocuMind codebase

---

## 1. Monorepo Principles & Workspace Management

DocuMind is structured as an **npm monorepo** with shared configuration across decoupled packages:
* Root `package.json` coordinates shared scripts and tooling via `workspaces`.
* `client/` owns all frontend React code.
* `server/` owns Express backend API and BullMQ worker code.

### Dependency Management Rules
* **Always** use workspace arguments when adding packages:
  ```bash
  # Add dependency to server
  npm install <package-name> --workspace=server

  # Add dev dependency to client
  npm install -D <package-name> --workspace=client
  ```
* Never install application dependencies in the monorepo root. Root dependencies are strictly reserved for linting, formatters, and workspace orchestration.

---

## 2. Git & Commit Conventions

Commit messages must follow the **Conventional Commits** specification:
```
<type>(<scope>): <short imperative summary>

[optional body explaining 'why', not 'what']
```

| Type | When to Use | Example |
| :--- | :--- | :--- |
| `feat` | New user-facing feature or API endpoint | `feat(ingestion): add coordinate extraction for pptx slides` |
| `fix` | Bug fix or error resolution | `fix(search): prevent division by zero in rrf ranking calculation` |
| `docs` | Documentation updates | `docs(api): update sse progress stream payload schema` |
| `refactor` | Code restructuring without feature change | `refactor(db): extract vector custom type into shared drizzle module` |
| `test` | Adding or updating unit/integration tests | `test(parsers): add scanned pdf detection unit tests` |
| `chore` | Dependency bumps, workspace tooling config | `chore(deps): update drizzle-orm to v0.36.0` |

---

## 3. TypeScript & Code Style Standards

### 3.1 Strict Type Safety
* `noImplicitAny: true` is strictly enforced.
* **Prohibited**: The use of `any` type is banned. Use `unknown` with runtime type narrowing or write explicit interfaces.
* **Shared Types**: API request/response contracts must be derived from **Zod schemas** (`z.infer<typeof schema>`).

### 3.2 Backend Code Organization (`server/`)
All backend features follow a **Layered Architecture**:
```
src/features/<feature-name>/
├── <feature>.controller.ts  # HTTP routing, Zod parsing, response mapping
├── <feature>.service.ts     # Business logic, coordination, transactions
├── <feature>.schema.ts      # Zod validation schemas & inferred types
└── <feature>.test.ts        # Unit & integration tests
```
* **Controllers** must never execute direct database queries or raw business calculations.
* **Services** must be stateless and easily testable.

### 3.3 Frontend Code Organization (`client/`)
All frontend UI follows a **Feature-Sliced Architecture**:
```
src/features/<feature-name>/
├── components/              # Feature-specific UI components
├── hooks/                   # Custom React hooks (TanStack Query mutations/queries)
├── api/                     # Axios API caller functions
└── types/                   # Feature-specific UI types
```
* **Shared Primitives**: Placed in `src/components/ui/` (shadcn/ui Radix primitives).
* **Global Stores**: Placed in `src/stores/` (Zustand client state).

---

## 4. Error Handling Standards

### Centralized Operational Error Pattern
All known operational errors extend `AppError`:
```typescript
export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number = 500,
    public errorCode: string = 'INTERNAL_ERROR',
    public details?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict detected', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}
```

* Express controllers must pass asynchronous errors to `next(err)`.
* The global error-handling middleware catches all exceptions, formats them into the standard error envelope, and strips stack traces in production.

---

## 5. Testing & Verification Requirements

### 5.1 Unit Testing with Vitest
* All parsers, chunking algorithms, and scoring algorithms must have unit tests.
* Parsers must be tested with sample files verifying that page numbers, tables, and notes are extracted accurately.
* The RRF hybrid scoring algorithm must be tested against edge cases (zero matches, identical ranks).

### 5.2 Integration Testing with Supertest
* File upload pipeline must be tested against duplicate SHA-256 detection (expecting `409 Conflict`).
* Search endpoints must be tested against keyword, semantic, and hybrid modes.
* Healthcheck endpoint must verify that database and Redis connection statuses report `connected`.

### 5.3 Verification Command Suite
Before opening PRs or merging code, execute:
```bash
# 1. Run typecheck across entire monorepo
npm run typecheck --workspaces

# 2. Run test suites
npm test --workspaces

# 3. Verify clean production build
npm run build --workspaces
```
