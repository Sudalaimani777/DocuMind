import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../errors/AppError.js';
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from '../utils/jwt.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  organization: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Verifies the HTTP-only access_token cookie and attaches req.user.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;
  if (!token) {
    next(new UnauthorizedError('Authentication required. Please sign in.'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      organization: payload.organization,
    };
    next();
  } catch (err) {
    next(err);
  }
}
