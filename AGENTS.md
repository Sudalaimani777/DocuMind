# AGENTS.md — AI Agent Directives & Engineering Governance

> **Target Audience**: All autonomous coding agents, LLM assistants, and automated contributors working inside the `DocuMind` repository.
> **Status**: Mandatory Enforcement across all turns and tasks.

---

## 1. Prime Directive & System Mission

You are working on **DocuMind** — an AI-Powered Document Processing & Intelligent Search Platform built with React 19, Express, Supabase PostgreSQL (`pgvector`), Redis (`BullMQ`), Cloudinary, and a Pluggable AI engine (Ollama + Google Gemini).

Your objective is to produce **clean, production-grade, highly resilient code** that adheres to strict engineering governance without shortcuts, incomplete placeholders, or architecture violations.

---

## 2. Immutable Constraints (Non-Negotiable)

1. **ZERO DOCKER**:
   * Do **NOT** introduce `Dockerfile`, `docker-compose.yml`, or containerization tooling.
   * All services run natively on host machine or connect directly to cloud providers (Supabase PostgreSQL with `pgvector`, Local/Cloud Redis, Cloudinary API, Local Ollama or Cloud Gemini API).
2. **NO MOCKUP CODE IN APPLICATION REPO**:
   * Do not commit static HTML preview mockups into `client/` or `server/`. Mockups belong strictly in standalone review artifacts outside the application bundle.
3. **FEATURE SCOPE BOUNDARIES**:
   * Features 5 (One-click batch operations) and 6 (Document-to-document visual diff/comparison) were **explicitly removed from scope**. Do not implement them or add dependencies for them.
4. **NO CODE TRUNCATION OR PLACEHOLDERS**:
   * Never output `// TODO: Implement later`, `/* ...rest of code */`, or mock placeholders in production files. Deliver complete, working, runnable implementations.
5. **EVIDENCE-BASED VERIFICATION**:
   * Never declare a task complete, fixed, or passing without executing real verification commands (`npm test`, `npm run build`, `tsc --noEmit`) and verifying zero exit codes.
6. **NO DIRECT COMMITS OR PUSHES WITHOUT DEVELOPER APPROVAL**:
   * Autonomous `git commit` and `git push` are **STRICTLY PROHIBITED**.
   * Whenever the agent makes any changes, additions, or updates, it must **NEVER** directly commit or push to GitHub.
   * The agent must always present the changes to the developer and **ASK FIRST**. Only after the developer reviews and explicitly approves may the agent commit and push.

---

## 3. Architecture & Boundary Rules

### A. Monorepo Organization
```
DocuMind/
├── client/     # Frontend SPA (React 19 + TypeScript + Vite)
├── server/     # Backend REST API & BullMQ Workers (Express + TypeScript)
└── docs/       # Master Architectural Documentation
```
* The `client/` and `server/` packages are decoupled. Shared types must be synchronized or maintained in a dedicated contract schema.
* Dependencies must be installed using `npm` workspaces (`npm install <package> --workspace=<workspace>`).

### B. Backend Layering Rules (`server/`)
* **Controllers**: Handle HTTP routing, validate request schemas via **Zod**, and delegate immediately to services. No SQL queries or business logic in controllers.
* **Services**: Encapsulate all business logic, deduplication hashing, coordinate parsing orchestration, and queue dispatching.
* **Database Access**: All queries must pass through **Drizzle ORM** with native `pgvector` operators (`<=>`). Raw SQL strings are prohibited unless specifically optimizing an HNSW index query.
* **Asynchronous Jobs**: Heavy operations (file extraction, chunking, AI embedding generation) must **never run synchronously** inside an Express HTTP request handler. Dispatch a BullMQ job and return `202 Accepted` immediately.

### C. Frontend Architecture Rules (`client/`)
* **Component Primitives**: Use **shadcn/ui** (Radix primitives) styled with **Tailwind CSS**.
* **State Segregation**:
  * **TanStack Query**: Owns all server state, document metadata lists, search queries, and cache invalidation.
  * **Zustand**: Owns client-only UI state (upload drawers, active chat session, drawer toggle states).
* **DOM Sanitization**: Any HTML generated for search highlights or extracted document previews **must be sanitized using `DOMPurify`** before rendering in the DOM.

---

## 4. Security & Safety Protocols

1. **File Ingestion Verification**:
   * Always inspect the **binary magic bytes** using `file-type` on the in-memory buffer before parsing. Never trust the file extension or user-provided `Content-Type` header.
   * Enforce a hard **25MB buffer size limit** in `Multer`.
2. **Cryptographic Deduplication**:
   * Compute a `SHA-256` checksum on every uploaded file buffer immediately. If an existing document with the same hash exists, reject with HTTP `409 Conflict`.
3. **Input Validation**:
   * All API request parameters, queries, and bodies must be validated with **Zod** schemas. Reject unknown or malformed payloads before business logic execution.
4. **AI Safety & RAG Grounding**:
   * Prompts sent to Gemini or Ollama must enforce strict grounding: *"Answer ONLY based on the provided excerpts. If the information is not present, reply that you do not know. Every claim must cite [DocName, Page X]."*

---

## 5. Development & Git Conventions

* **Branching**: All work is tracked against the active branch (e.g., `Project` or feature branches).
* **Commit & Push Gate (Human Approval Required)**:
  * Autonomous `git commit` and `git push` are strictly forbidden.
  * Whenever the AI makes any modifications, it must summarize the changes and **ASK FIRST**.
  * Only after the developer explicitly approves may the agent proceed with `git commit` and `git push`.
* **Commit Messages**: Follow standard Conventional Commits:
  * `feat: <description>` — New feature
  * `fix: <description>` — Bug fix
  * `docs: <description>` — Documentation changes
  * `refactor: <description>` — Code refactoring without behavior change
  * `test: <description>` — Adding or updating test suites
  * `chore: <description>` — Maintenance or dependency updates
* **File References**: Always use clickable GitHub-style markdown file links with absolute or relative paths (e.g., `[README.md](file:///c:/Users/SudalaimaniKannan/Documents/Codings/Projects/DocuMind/README.md)`).

---

## 6. Verification Checklist Before Hand-off

Before reporting any milestone or task complete:
1. Run TypeScript typecheck: `npm run typecheck --workspace=<workspace>` (or `npx -w <workspace> tsc --noEmit`)
2. Run test suites: `npm test`
3. Verify that zero Docker or container configs were introduced.
4. Verify that documentation files were updated to reflect any architectural or schema adjustments.
