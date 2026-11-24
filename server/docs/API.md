# Server API Routing & Controller Specifications — DocuMind

> **Package**: `server/`  
> **Router Prefix**: `/api`  
> **Validation**: Zod Runtime Schema Validation

---

## 1. Route Registry & Middleware Stacks

| Method | Path | Middleware Stack | Controller Action |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/documents/upload` | `uploadLimiter`, `multer.array('files', 5)`, `validateMagicBytes` | `UploadController.handleUpload` |
| `GET` | `/api/documents` | `generalLimiter`, `validate(listDocsSchema)` | `DocumentController.list` |
| `GET` | `/api/documents/:id` | `generalLimiter`, `validate(uuidParamSchema)` | `DocumentController.getById` |
| `DELETE` | `/api/documents/:id` | `generalLimiter`, `validate(uuidParamSchema)` | `DocumentController.delete` |
| `GET` | `/api/search` | `generalLimiter`, `validate(searchQuerySchema)` | `SearchController.search` |
| `POST` | `/api/chat/rag` | `aiLimiter`, `validate(ragChatBodySchema)` | `RagController.streamChat` |
| `GET` | `/api/jobs/:id/progress`| Native SSE connection handler | `JobController.streamProgress` |
| `GET` | `/api/jobs` | `generalLimiter`, `validate(paginationSchema)` | `JobController.listJobs` |
| `POST` | `/api/jobs/:id/retry` | `generalLimiter`, `validate(uuidParamSchema)` | `JobController.retryJob` |
| `GET` | `/api/settings/provider`| `generalLimiter` | `SettingsController.getProvider` |
| `POST` | `/api/settings/provider`| `generalLimiter`, `validate(setProviderSchema)` | `SettingsController.setProvider` |
| `GET` | `/health` | None (Direct ping) | `HealthController.check` |

---

## 2. Request Validation Schemas (Zod)

```typescript
import { z } from 'zod';

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
    conversationHistory: z.array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    ).max(20).default([]),
  }),
});

export const setProviderSchema = z.object({
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
