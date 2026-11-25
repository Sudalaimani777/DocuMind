import { Router } from 'express';
import { documentUploadQuerySchema, uuidParamSchema } from '@documind/shared';
import { asyncErrorWrapper } from '../../core/middleware/asyncErrorWrapper.js';
import { generalLimiter, uploadLimiter } from '../../core/middleware/rateLimiter.js';
import { requireAuth } from '../../core/middleware/requireAuth.js';
import { uploadDocumentsMiddleware } from '../../core/middleware/upload.middleware.js';
import { validate } from '../../core/middleware/validate.js';
import { validateMagicBytes } from '../../core/middleware/validateMagicBytes.js';
import type { DocumentController } from './document.controller.js';
import { listDocumentsQuerySchema } from './document.schema.js';

/**
 * Mounts /api/v1/documents endpoints with auth, rate limiting, and Zod validation.
 */
export function createDocumentsRouter(documentController: DocumentController): Router {
  const router = Router();

  router.post(
    '/upload',
    requireAuth,
    uploadLimiter,
    uploadDocumentsMiddleware,
    validateMagicBytes,
    validate({ query: documentUploadQuerySchema }),
    asyncErrorWrapper((req, res, next) => documentController.upload(req, res, next))
  );

  router.get(
    '/',
    requireAuth,
    generalLimiter,
    validate({ query: listDocumentsQuerySchema }),
    asyncErrorWrapper((req, res, next) => documentController.list(req, res, next))
  );

  router.get(
    '/:id',
    requireAuth,
    generalLimiter,
    validate({ params: uuidParamSchema }),
    asyncErrorWrapper((req, res, next) => documentController.getById(req, res, next))
  );

  router.delete(
    '/:id',
    requireAuth,
    generalLimiter,
    validate({ params: uuidParamSchema }),
    asyncErrorWrapper((req, res, next) => documentController.delete(req, res, next))
  );

  return router;
}
