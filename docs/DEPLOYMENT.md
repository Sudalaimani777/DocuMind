# Deployment & Operations Guide — DocuMind

> **Status**: Production Runbook  
> **Architecture Mode**: Direct Host & Cloud Managed Services (Zero Docker)

---

## 1. Deployment Philosophy & Topology

DocuMind operates natively on host servers (Linux, macOS, Windows) or modern cloud platforms without requiring Docker containerization:
* **Frontend**: Static single-page application built with Vite, deployable to Cloudflare Pages, Vercel, Netlify, or served via Nginx/Express.
* **Backend API & BullMQ Workers**: Node.js 20+ processes running via a process manager (e.g., **PM2** or systemd).
* **Database**: PostgreSQL 16+ with `pgvector` (e.g., Neon, Supabase, AWS RDS, or local Postgres).
* **Queue & Cache**: Redis 7+ (e.g., Upstash, Redis Cloud, or local Redis).
* **Binary Storage**: Cloudinary (managed cloud storage).

---

## 2. Infrastructure Prerequisites

| Component | Minimum Version | Production Recommendations |
| :--- | :--- | :--- |
| **Node.js** | `v20.10.0 LTS` | Ensure Node.js is on system `PATH`. |
| **Package Manager** | `pnpm v9.x` | High-speed hard-linked dependency caching. |
| **PostgreSQL** | `v16.x` | Must have `pgvector` extension installed (`CREATE EXTENSION vector;`). |
| **Redis** | `v7.x` | Minimum 256MB memory with persistence enabled (AOF or RDB). |
| **AI Provider** | Cloud / Local | Gemini API Key (recommended for cloud production) or local Ollama. |

---

## 3. Environment Variable Checklist

### Server (`server/.env`)
```bash
# Core Server Configuration
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://documind.yourdomain.com

# Database Connection
DATABASE_URL=postgres://user:password@db-host.com:5432/documind?sslmode=require

# Redis Connection (BullMQ)
REDIS_URL=redis://default:password@redis-host.com:6379

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# AI Provider Configuration
ACTIVE_AI_PROVIDER=gemini # 'gemini' or 'ollama'
GEMINI_API_KEY=AIzaSy...
OLLAMA_BASE_URL=http://localhost:11434
```

### Client (`client/.env`)
```bash
VITE_API_URL=https://api.documind.yourdomain.com/api
VITE_SSE_URL=https://api.documind.yourdomain.com/api/jobs
```

---

## 4. Production Build & Migration Pipeline

```bash
# 1. Install production dependencies
pnpm install --frozen-lockfile

# 2. Run Drizzle database migrations
pnpm --filter server db:migrate

# 3. Build Backend (Compiles TypeScript to dist/)
pnpm --filter server build

# 4. Build Frontend (Produces optimized static assets in dist/)
pnpm --filter client build
```

---

## 5. Process Orchestration with PM2

To ensure high availability and automatic restarts on failures:

### `ecosystem.config.cjs`
```javascript
module.exports = {
  apps: [
    {
      name: 'documind-api',
      script: './server/dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'documind-worker',
      script: './server/dist/workers/ingestion.worker.js',
      instances: 2, // Scales background parsing independently
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

### Start & Monitor Commands
```bash
# Start all processes
pm2 start ecosystem.config.cjs

# Save PM2 process list across system reboots
pm2 save
pm2 startup

# Monitor live metrics & logs
pm2 status
pm2 logs documind-api
```

---

## 6. Post-Deployment Verification Checklist

1. **API Healthcheck**: Query `https://api.yourdomain.com/api/health` and verify `status: "healthy"` and database/redis connectivity.
2. **HNSW Index Check**: Confirm vector index is active in PostgreSQL:
   ```sql
   SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'document_chunks';
   ```
3. **Upload Test**: Upload a multi-page test PDF and monitor SSE stream completion.
4. **Hybrid Search Test**: Execute a query and verify reciprocal rank fusion output.
5. **RAG Citation Test**: Query the assistant and verify that citation badges open source drawer.
