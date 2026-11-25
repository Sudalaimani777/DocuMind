import type { NextFunction, Request, Response } from 'express';
import type { ApiErrorResponse } from '@documind/shared';
import { unifiedConfig } from '../config/unifiedConfig.js';
import { AppError } from '../errors/AppError.js';

/**
 * Global Express error handling middleware returning the standardized error envelope.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isProd = unifiedConfig.server.nodeEnv === 'production';

  if (err instanceof AppError) {
    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
      timestamp: new Date().toISOString(),
    };
    res.status(err.statusCode).json(body);
    return;
  }

  const message =
    !isProd && err instanceof Error
      ? err.message
      : 'An unexpected internal server error occurred.';

  const body: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
    timestamp: new Date().toISOString(),
  };

  res.status(500).json(body);
}
