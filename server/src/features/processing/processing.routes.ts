import { Router } from 'express';
import { paginationSchema, uuidParamSchema } from '@documind/shared';
import { asyncErrorWrapper } from '../../core/middleware/asyncErrorWrapper.js';
import { generalLimiter } from '../../core/middleware/rateLimiter.js';
import { requireAuth } from '../../core/middleware/requireAuth.js';
import { validate } from '../../core/middleware/validate.js';
import type { JobController } from './job.controller.js';

/**
 * Mounts /api/v1/processing SSE endpoints.
 */
export function createProcessingRouter(jobController: JobController): Router {
  const router = Router();

  router.get('/events', requireAuth, (req, res, next) =>
    jobController.streamEvents(req, res, next)
  );

  return router;
}

/**
 * Mounts /api/v1/jobs REST and SSE endpoints.
 */
export function createJobsRouter(jobController: JobController): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    generalLimiter,
    validate({ query: paginationSchema }),
    asyncErrorWrapper((req, res, next) => jobController.listJobs(req, res, next))
  );

  router.get(
    '/:id/progress',
    requireAuth,
    validate({ params: uuidParamSchema }),
    (req, res, next) => jobController.streamJobProgress(req, res, next)
  );

  router.post(
    '/:id/retry',
    requireAuth,
    generalLimiter,
    validate({ params: uuidParamSchema }),
    asyncErrorWrapper((req, res, next) => jobController.retryJob(req, res, next))
  );

  return router;
}
