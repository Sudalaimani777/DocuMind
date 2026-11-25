import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ValidationError } from '../errors/AppError.js';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Express middleware that validates request body, query, and params against Zod schemas.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated: Record<string, unknown> = {};

      if (schemas.body) {
        const parsedBody = schemas.body.parse(req.body);
        req.body = parsedBody;
        validated.body = parsedBody;
      }

      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query);
        validated.query = parsedQuery;
      }

      if (schemas.params) {
        const parsedParams = schemas.params.parse(req.params);
        validated.params = parsedParams;
      }

      res.locals.validated = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        next(new ValidationError('Validation failed on input parameters.', details));
        return;
      }
      next(error);
    }
  };
}
