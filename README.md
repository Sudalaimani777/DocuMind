# DocuMind — AI-Powered Document Processing & Intelligent Search Platform

> **Intelligence Beyond Documents**: An enterprise document intelligence platform that extracts multi-format documents, generates vector embeddings, and enables hybrid search and grounded RAG Q&A with verifiable citations.

---

## 📌 Table of Contents
- [Executive Overview](#-executive-overview)
- [Key Capabilities](#-key-capabilities)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Repository Structure](#-repository-structure)
- [Prerequisites & Local Setup](#-prerequisites--local-setup)
- [Environment Configuration](#-environment-configuration)
- [Development Workflow](#-development-workflow)
- [Documentation Index](#-documentation-index)
- [License](#-license)

---

## 🎯 Executive Overview

Organizations accumulate massive volumes of unstructured documents (PDFs, Word documents, Excel spreadsheets, PowerPoint presentations). Traditional tools suffer from:
1. **Keyword Search Blindness**: Inability to match conceptual meaning or semantic synonyms.
2. **Loss of Relational Context**: Flattening tables, slides, and headings into unstructured plain text without coordinates.
3. **AI Hallucinations**: Generic AI models generating answers without verifiable citations back to the source page or row.

**DocuMind** solves this by combining coordinate-aware multi-format parsers, asynchronous background worker pipelines, PostgreSQL Full-Text Search, `pgvector` semantic similarity, and grounded RAG (Retrieval-Augmented Generation).

---

## ⚡ Key Capabilities

* **Multi-Format Ingestion**: Coordinate-aware extraction for PDF (page numbers, scanned check), Word `.docx` (tables, headings), Excel `.xlsx` (sheets, rows), and PowerPoint `.pptx` (slides, notes).
* **Cryptographic Deduplication**: SHA-256 binary hash checking before storage or embedding generation to eliminate duplicate processing and AI costs.
* **Asynchronous Processing**: Redis and BullMQ job queue with exponential backoff retries and live Server-Sent Events (SSE) progress streaming.
* **Hybrid Search Engine**: Reciprocal Rank Fusion (RRF) combining PostgreSQL Full-Text Search (`tsvector`/`GIN`) and `pgvector` cosine similarity (`<=>`).
* **Grounded RAG Assistant**: Strictly constrained prompts requiring verifiable citations linking answers to exact page, slide, or sheet coordinates.
* **Enterprise Security**: Binary magic-bytes inspection (`file-type`), 25MB buffer guards (`Multer`), XSS sanitization (`DOMPurify`), and API rate limiting (`express-rate-limit`).
* **Pluggable AI Engine**: Supports both **Local AI** (Ollama `nomic-embed-text`) and **Cloud AI** (Google Gemini `text-embedding-004` & `gemini-1.5-flash`) at a standardized 768 dimensions.

---

## 🏛️ System Architecture

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

## 🛠️ Technology Stack

| Layer | Technologies | Role in Platform |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui | High-speed SPA with enterprise Deep Navy theme |
| **State & API** | Zustand, TanStack Query, Axios | Server cache management, local upload state, HTTP client |
| **Backend API** | Node.js, Express, TypeScript | Modular REST API server with shared types |
| **Database & Vector** | PostgreSQL with `pgvector`, Drizzle ORM | ACID metadata storage + 768-dim HNSW vector similarity |
| **Queue & Cache** | Redis, BullMQ | Asynchronous job queues and exponential retry handling |
| **File Storage** | Cloudinary SDK (`raw` resource type) | Secure off-server binary document storage |
| **Parsers** | `pdf-parse`, `mammoth`, `xlsx`, `pptx2json` | Native coordinate-aware text and table extraction |
| **Security** | `file-type`, `Multer`, `Helmet`, `CORS`, `express-rate-limit`, `DOMPurify` | Multi-layer upload security and abuse prevention |
| **AI & LLM** | Ollama (`nomic-embed-text`) & Google Gemini API | Pluggable 768-dim embeddings and grounded synthesis |

---

## 📂 Repository Structure

```
DocuMind/
├── client/                     # Frontend Application (React 19 + Vite)
│   ├── docs/                   # Client-specific specifications & guidelines
│   ├── src/                    # UI features, components, hooks, stores
│   └── package.json
├── server/                     # Backend API & Workers (Express + TypeScript)
│   ├── docs/                   # Server-specific architecture & contracts
│   ├── src/                    # Controllers, services, parsers, db schema
│   └── package.json
├── docs/                       # Monorepo Master Documentation
│   ├── PROJECT_OVERVIEW.md
│   ├── REQUIREMENTS.md
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── TECH_STACK.md
│   ├── DATABASE_DESIGN.md
│   ├── API_CONTRACT.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   └── DEVELOPMENT_GUIDELINES.md
├── AGENTS.md                   # AI Agent System Directives & Engineering Rules
├── features.md                 # Product Feature Catalog
└── README.md                   # Repository Entry Point
```

---

## 📋 Prerequisites & Local Setup

### System Requirements
* **Node.js**: `v20.x` or higher
* **Package Manager**: `npm` (`v10.x` recommended, standard Node.js package manager)
* **PostgreSQL**: `v16.x` with `pgvector` extension enabled
* **Redis**: `v7.x` (running on `localhost:6379`)
* **AI Provider** (One of the following):
  * **Ollama** installed locally with `nomic-embed-text` (`ollama pull nomic-embed-text`)
  * **Google Gemini API Key** (for cloud embedding & generation)

---

## ⚙️ Environment Configuration

### Server (`server/.env`)
```bash
PORT=5000
NODE_ENV=development
DATABASE_URL=postgres://postgres:password@localhost:5432/documind
REDIS_URL=redis://localhost:6379

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# AI Configuration
ACTIVE_AI_PROVIDER=gemini # or 'ollama'
GEMINI_API_KEY=your_gemini_api_key
OLLAMA_BASE_URL=http://localhost:11434
```

### Client (`client/.env`)
```bash
VITE_API_URL=http://localhost:5000/api
VITE_SSE_URL=http://localhost:5000/api/jobs
```

---

## 💻 Development Workflow

```bash
# 1. Install dependencies across monorepo
npm install

# 2. Push database schema migrations
npm run db:migrate --workspace=server

# 3. Start development servers concurrently
npm run dev
```
* **Frontend**: `http://localhost:5173`
* **Backend API**: `http://localhost:5000`
* **Healthcheck**: `http://localhost:5000/health`

---

## 📚 Documentation Index

For in-depth specifications, refer to our comprehensive documentation suite:

* [**Project Overview**](docs/PROJECT_OVERVIEW.md) — Mission, goals, and problem definition.
* [**System Requirements**](docs/REQUIREMENTS.md) — Functional and non-functional specifications.
* [**System Architecture**](docs/SYSTEM_ARCHITECTURE.md) — End-to-end data flows and component topology.
* [**Technology Stack**](docs/TECH_STACK.md) — Technical evaluations and trade-offs.
* [**Database Design**](docs/DATABASE_DESIGN.md) — PostgreSQL schema, `pgvector` indexing, and Drizzle models.
* [**API Contract**](docs/API_CONTRACT.md) — RESTful endpoints, request/response schemas, and SSE contracts.
* [**Security Architecture**](docs/SECURITY.md) — File ingestion defense, sanitization, and rate limiting.
* [**Deployment Guide**](docs/DEPLOYMENT.md) — Production build, runtime orchestration, and database setup.
* [**Development Guidelines**](docs/DEVELOPMENT_GUIDELINES.md) — Monorepo standards, code style, and testing requirements.
* [**AI Agent Rules (AGENTS.md)**](AGENTS.md) — Engineering rules and protocols for autonomous coding agents.

---

## 📄 License
This project is licensed under the MIT License.
