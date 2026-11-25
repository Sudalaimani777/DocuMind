import { Router } from 'express';
import { signinSchema, signupSchema } from '@documind/shared';
import { asyncErrorWrapper } from '../../core/middleware/asyncErrorWrapper.js';
import { authLimiter } from '../../core/middleware/rateLimiter.js';
import { requireAuth } from '../../core/middleware/requireAuth.js';
import { validate } from '../../core/middleware/validate.js';
import type { AuthController } from './auth.controller.js';

/**
 * Mounts /api/v1/auth endpoints onto an Express Router.
 */
export function createAuthRouter(authController: AuthController): Router {
  const router = Router();

  router.post(
    '/signup',
    authLimiter,
    validate({ body: signupSchema }),
    asyncErrorWrapper((req, res, next) => authController.signup(req, res, next))
  );

  router.post(
    '/signin',
    authLimiter,
    validate({ body: signinSchema }),
    asyncErrorWrapper((req, res, next) => authController.signin(req, res, next))
  );

  router.post(
    '/signout',
    asyncErrorWrapper((req, res, next) => authController.signout(req, res, next))
  );

  router.get(
    '/me',
    requireAuth,
    asyncErrorWrapper((req, res, next) => authController.me(req, res, next))
  );

  router.post(
    '/refresh',
    asyncErrorWrapper((req, res, next) => authController.refresh(req, res, next))
  );

  return router;
}
