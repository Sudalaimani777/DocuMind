import { Router } from 'express';
import { searchQuerySchema } from '@documind/shared';
import { asyncErrorWrapper } from '../../core/middleware/asyncErrorWrapper.js';
import { generalLimiter } from '../../core/middleware/rateLimiter.js';
import { requireAuth } from '../../core/middleware/requireAuth.js';
import { validate } from '../../core/middleware/validate.js';
import type { SearchController } from './search.controller.js';

/**
 * Mounts /api/v1/search endpoints with auth, rate limiting, and Zod validation.
 */
export function createSearchRouter(searchController: SearchController): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    generalLimiter,
    validate({ query: searchQuerySchema }),
    asyncErrorWrapper((req, res, next) => searchController.searchGet(req, res, next))
  );

  router.post(
    '/',
    requireAuth,
    generalLimiter,
    validate({ body: searchQuerySchema }),
    asyncErrorWrapper((req, res, next) => searchController.searchPost(req, res, next))
  );

  return router;
}
