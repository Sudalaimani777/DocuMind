# Server API Routing & Controller Specifications — DocuMind

> **Package**: `server/`  
> **Router Prefix**: `/api`  
> **Validation**: Zod Runtime Schema Validation

---

## 1. Route Registry & Middleware Stacks

| Method | Path | Middleware Stack | Controller Action | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/signup` | `authLimiter`, `validate(signupSchema)` | `AuthController.signup` | Registers user (Name, Org, Email, Pass), sets cookies |
| `POST` | `/api/v1/auth/signin` | `authLimiter`, `validate(signinSchema)` | `AuthController.signin` | Verifies password hash, sets JWT auth cookies |
| `POST` | `/api/v1/auth/signout` | None | `AuthController.signout` | Clears JWT auth cookies |
| `GET` | `/api/v1/auth/me` | `requireAuth` | `AuthController.me` | Returns current user profile |
| `POST` | `/api/v1/documents/upload` | `requireAuth`, `uploadLimiter`, `multer.array('files', 5)`, `validateMagicBytes` | `UploadController.handleUpload` | Enqueues files into BullMQ, streams to Cloudinary |
| `GET` | `/api/v1/documents` | `requireAuth`, `generalLimiter`, `validate(listDocsSchema)` | `DocumentController.list` | User-scoped document library list |
| `GET` | `/api/v1/documents/:id` | `requireAuth`, `generalLimiter`, `validate(uuidParamSchema)` | `DocumentController.getById` | User-scoped single document details |
| `DELETE` | `/api/v1/documents/:id` | `requireAuth`, `generalLimiter`, `validate(uuidParamSchema)` | `DocumentController.delete` | Cascading deletion of document, chunks, Cloudinary asset |
| `GET` | `/api/v1/search` | `requireAuth`, `generalLimiter`, `validate(searchQuerySchema)` | `SearchController.search` | User-scoped Hybrid, Semantic, or Keyword search |
| `POST` | `/api/v1/chat/rag` | `requireAuth`, `aiLimiter`, `validate(ragChatBodySchema)` | `RagController.streamChat` | Grounded RAG with citations and SSE streaming |
| `GET` | `/api/v1/chat/sessions` | `requireAuth`, `generalLimiter` | `ChatHistoryController.listSessions` | Lists user's past chat history sessions |
| `GET` | `/api/v1/chat/sessions/:id/messages` | `requireAuth`, `generalLimiter`, `validate(uuidParamSchema)` | `ChatHistoryController.getMessages` | Retrieves all messages in a past session |
| `DELETE` | `/api/v1/chat/sessions/:id` | `requireAuth`, `generalLimiter`, `validate(uuidParamSchema)` | `ChatHistoryController.deleteSession` | Deletes a chat history session |
| `GET` | `/api/v1/jobs/:id/progress` | `requireAuth`, Native SSE handler | `JobController.streamProgress` | Real-time SSE worker progress stream |
| `GET` | `/api/v1/jobs` | `requireAuth`, `generalLimiter`, `validate(paginationSchema)` | `JobController.listJobs` | User-scoped processing job table |
| `POST` | `/api/v1/jobs/:id/retry` | `requireAuth`, `generalLimiter`, `validate(uuidParamSchema)` | `JobController.retryJob` | Re-queues a failed job into BullMQ |
| `GET` | `/api/v1/settings` | `requireAuth`, `generalLimiter` | `SettingsController.getSettings` | Returns active AI provider & configuration |
| `PUT` | `/api/v1/settings` | `requireAuth`, `generalLimiter`, `validate(updateSettingsSchema)` | `SettingsController.updateSettings` | Toggles provider (Ollama / Gemini) or endpoints |
| `POST` | `/api/v1/settings/test-connection` | `requireAuth`, `generalLimiter`, `validate(testConnectionSchema)` | `SettingsController.testConnection` | Pings active provider and measures latency |
| `GET` | `/health` | None (Direct ping) | `HealthController.check` | Database, Redis, and AI service healthcheck |

---

## 2. Request Validation Schemas (Zod)

```typescript
import { z } from 'zod';

export const signupSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    organization: z.string().trim().min(1, 'Organization is required').max(150),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  }),
});

export const signinSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const uuidParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid UUID format'),
  }),
});

export const listDocsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    fileType: z.enum(['pdf', 'docx', 'xlsx', 'pptx']).optional(),
    status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  }),
});

export const searchQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().min(1, 'Search query cannot be empty').max(300),
    mode: z.enum(['hybrid', 'keyword', 'semantic']).default('hybrid'),
    format: z.enum(['pdf', 'docx', 'xlsx', 'pptx']).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export const ragChatBodySchema = z.object({
  body: z.object({
    query: z.string().trim().min(1).max(1000),
    documentId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
  }),
});

export const updateSettingsSchema = z.object({
  body: z.object({
    activeAiProvider: z.enum(['ollama', 'gemini']).optional(),
    ollamaBaseUrl: z.string().url().optional(),
    chunkSize: z.number().int().min(200).max(2000).optional(),
    chunkOverlap: z.number().int().min(20).max(400).optional(),
  }),
});

export const testConnectionSchema = z.object({
  body: z.object({
    provider: z.enum(['ollama', 'gemini']),
  }),
});
```

---

## 3. Controller Implementation Standards

Every controller must:
1. Receive validated DTOs from `res.locals.validated` (populated by `validate` middleware).
2. Delegate business operations immediately to the corresponding service.
3. Return standard HTTP status codes:
   * `200 OK`: Successful read, update, or synchronous completion.
   * `202 Accepted`: Background job enqueued.
   * `400 Bad Request`: Validation failure.
   * `404 Not Found`: Entity does not exist.
   * `409 Conflict`: Duplicate file detection.
   * `429 Too Many Requests`: Rate limit exceeded.
   * `500 Internal Server Error`: Unhandled system exception.

```typescript
// Example: UploadController
export class UploadController {
  static async handleUpload(req: Request, res: Response, next: NextFunction) {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new BadRequestError('No files uploaded');
      }

      const results = await IngestionService.queueUploads(files);
      return res.status(202).json({
        success: true,
        data: results,
        message: `${results.length} file(s) queued for ingestion.`,
      });
    } catch (err) {
      next(err);
    }
  }
}
```
