# Authentication & Authorization Architecture — DocuMind Server

> **Package**: `server/`  
> **Current Mode**: Single-Tenant Enterprise Workspace with API Key Support  
> **Roadmap**: Multi-Tenant JWT & Role-Based Access Control (RBAC)

---

## 1. Current Architecture (MVP Phase)

DocuMind is currently architected as a **dedicated enterprise workspace** operating within an isolated intranet or authenticated boundary:
* **Stateless API Design**: The backend maintains no HTTP sessions or session cookies in memory.
* **Origin Boundary**: Protected via strict CORS origin enforcement (`CORS_ORIGIN`).
* **Abuse Protection**: Enforced via `express-rate-limit` tracking client IP addresses across upload, search, and AI endpoints.
* **Service-to-Service API Key**: Incoming requests from external services or automated scrapers authenticate via the `X-API-Key` header:

```typescript
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.header('X-API-Key');
  const configuredKey = process.env.SERVICE_API_KEY;

  if (configuredKey && apiKey !== configuredKey) {
    throw new UnauthorizedError('Invalid or missing API key.');
  }

  next();
}
```

---

## 2. Future Multi-Tenant & RBAC Extensibility Roadmap

The database schema and architecture are intentionally prepared for seamless expansion into multi-tenant user authentication:

### 2.1 Planned User Roles & Permissions
```
┌────────────────────────────────────────────────────────┐
│                   ROLE HIERARCHY                       │
├───────────────┬────────────────────────────────────────┤
│ ADMIN         │ Full system access, provider config,   │
│               │ delete documents, retry all jobs       │
├───────────────┼────────────────────────────────────────┤
│ ANALYST       │ Upload documents, execute searches,    │
│               │ chat with documents, export results    │
├───────────────┼────────────────────────────────────────┤
│ VIEWER        │ Read-only search and chat access.      │
│               │ Cannot upload or delete documents      │
└───────────────┴────────────────────────────────────────┘
```

### 2.2 Database Schema Migration Path
When multi-tenancy is activated, the following columns will be added via Drizzle migration:
```typescript
// Future Schema Additions:
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 30 }).default('analyst').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Adding ownerId to documents table:
// ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' })
```

### 2.3 JWT Bearer Token Blueprint
```typescript
export interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'analyst' | 'viewer';
}
```
* **Authentication Middleware**: Verifies `Authorization: Bearer <token>` using `jsonwebtoken`.
* **RBAC Guard Middleware**: Validates that `req.user.role` satisfies required endpoint permissions (e.g. `authorize(['admin'])` for `POST /api/settings/provider`).
