import type { NextFunction, Response } from 'express';
import type { ApiResponse } from '@documind/shared';

/**
 * Base controller providing standardized API response and error forwarding helpers.
 */
export abstract class BaseController {
  protected handleSuccess<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode = 200
  ): void {
    const payload: ApiResponse<T> = {
      success: true,
      data,
      ...(message !== undefined ? { message } : {}),
      timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(payload);
  }

  protected handleError(error: unknown, next: NextFunction): void {
    next(error);
  }
}
