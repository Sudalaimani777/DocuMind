import { Router } from 'express';
import { ragChatRequestSchema } from '@documind/shared';
import { asyncErrorWrapper } from '../../core/middleware/asyncErrorWrapper.js';
import { aiLimiter } from '../../core/middleware/rateLimiter.js';
import { requireAuth } from '../../core/middleware/requireAuth.js';
import { validate } from '../../core/middleware/validate.js';
import type { RagController } from './rag.controller.js';

/**
 * Mounts /api/v1/chat/rag endpoint with auth, AI rate limiting, and Zod validation.
 */
export function createRagRouter(ragController: RagController): Router {
  const router = Router();

  router.post(
    '/rag',
    requireAuth,
    aiLimiter,
    validate({ body: ragChatRequestSchema }),
    asyncErrorWrapper((req, res, next) => ragController.chat(req, res, next))
  );

  return router;
}
