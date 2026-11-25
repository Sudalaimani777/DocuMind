import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

/**
 * Wraps async Express route handlers and forwards rejected promises to error middleware.
 */
export function asyncErrorWrapper(handler: AsyncRouteHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
