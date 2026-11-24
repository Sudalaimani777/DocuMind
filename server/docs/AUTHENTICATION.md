# Authentication & Authorization Architecture — DocuMind Server

> **Package**: `server/`  
> **Architecture**: Native Email/Password Authentication with Organization & JWT Cookies  
> **Security Standard**: `bcrypt` (10 rounds) + HTTP-Only SameSite=Lax JWT Cookies  
> **Role Model**: Equal Standard Users (Zero RBAC complexity) with Strict Private Document Workspaces

---

## 1. Architectural Principles

1. **Self-Contained & Native**:
   * No third-party SaaS authentication dependencies (Auth0, Clerk, Firebase).
   * Fully powered by PostgreSQL (`users` table) and Express middleware.
2. **Strict Data Isolation (Private Workspaces)**:
   * Every document, processing job, and chat session belongs to a specific `user_id`.
   * User A cannot see, search, or chat with User B's documents.
   * Cryptographic deduplication is enforced per user: `UNIQUE (user_id, sha256_hash)`.
3. **Equal User Capabilities (No Roles/RBAC)**:
   * All authenticated users have identical permissions: upload, view documents, search, chat with RAG assistant, view history, and toggle personal settings.
4. **XSS-Resistant Cookie Delivery**:
   * JWT tokens are delivered exclusively in `httpOnly`, `Secure` (in production), `SameSite=Lax` cookies.
   * Zero auth tokens stored in JavaScript `localStorage` or `sessionStorage`.

---

## 2. Database Schema (`users` Table)

```typescript
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  organization: varchar('organization', { length: 150 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

---

## 3. Token Strategy & Lifecycle

* **Access Token**:
  * Expiration: 1 hour (`60m`).
  * Payload: `{ sub: user.id, email: user.email, name: user.name, organization: user.organization }`.
  * Cookie Name: `access_token`.
* **Refresh Token**:
  * Expiration: 7 days (`7d`).
  * Payload: `{ sub: user.id, tokenVersion: 1 }`.
  * Cookie Name: `refresh_token`.

---

## 4. REST API Endpoints (`/api/v1/auth`)

| Endpoint | Method | Input (Zod Validated) | Description | Response |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/auth/signup` | `POST` | `name`, `organization`, `email`, `password` | Hashes password with `bcrypt`, creates user, issues auth cookies. | `{ success: true, data: { user } }` |
| `/api/v1/auth/signin` | `POST` | `email`, `password` | Validates credentials against `bcrypt` hash, issues auth cookies. | `{ success: true, data: { user } }` |
| `/api/v1/auth/signout` | `POST` | None | Clears `access_token` and `refresh_token` cookies. | `{ success: true, message: "Signed out" }` |
| `/api/v1/auth/me` | `GET` | Cookie | Decodes access token, returns current user profile on app load. | `{ success: true, data: { user } }` |
| `/api/v1/auth/refresh` | `POST` | Refresh Cookie | Issues a new 1-hour access token using the 7-day refresh token. | `{ success: true }` |

---

## 5. Authentication Middleware (`requireAuth`)

```typescript
// server/src/core/middleware/requireAuth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../errors/AppError';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        organization: string;
      };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.access_token;
  if (!token) {
    throw new UnauthorizedError('Authentication required. Please sign in.');
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string;
      email: string;
      name: string;
      organization: string;
    };

    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      organization: payload.organization,
    };

    next();
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired authentication session.');
  }
}
```
