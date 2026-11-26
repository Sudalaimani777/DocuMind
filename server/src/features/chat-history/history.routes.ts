import { Router } from 'express';
import { chatSessionsQuerySchema, uuidParamSchema } from '@documind/shared';
import { asyncErrorWrapper } from '../../core/middleware/asyncErrorWrapper.js';
import { generalLimiter } from '../../core/middleware/rateLimiter.js';
import { requireAuth } from '../../core/middleware/requireAuth.js';
import { validate } from '../../core/middleware/validate.js';
import type { HistoryController } from './history.controller.js';

/**
 * Mounts /api/v1/chat/sessions endpoints with auth, rate limiting, and Zod validation.
 */
export function createHistoryRouter(historyController: HistoryController): Router {
  const router = Router();

  router.get(
    '/sessions',
    requireAuth,
    generalLimiter,
    validate({ query: chatSessionsQuerySchema }),
    asyncErrorWrapper((req, res, next) => historyController.listSessions(req, res, next))
  );

  router.get(
    '/sessions/:id/messages',
    requireAuth,
    generalLimiter,
    validate({ params: uuidParamSchema }),
    asyncErrorWrapper((req, res, next) => historyController.getSessionMessages(req, res, next))
  );

  router.delete(
    '/sessions/:id',
    requireAuth,
    generalLimiter,
    validate({ params: uuidParamSchema }),
    asyncErrorWrapper((req, res, next) => historyController.deleteSession(req, res, next))
  );

  return router;
}
