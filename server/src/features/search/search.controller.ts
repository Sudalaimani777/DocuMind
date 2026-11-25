import type { NextFunction, Request, Response } from 'express';
import type { SearchQueryInput } from '@documind/shared';
import { BaseController } from '../../core/controllers/BaseController.js';
import { UnauthorizedError } from '../../core/errors/AppError.js';
import type { SearchService } from './search.service.js';

/**
 * HTTP controller for multi-mode document chunk search (GET and POST).
 */
export class SearchController extends BaseController {
  constructor(private readonly searchService: SearchService) {
    super();
  }

  async searchGet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const query = res.locals.validated?.query as SearchQueryInput;
      const result = await this.searchService.search(req.user.id, query);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, next);
    }
  }

  async searchPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const body = res.locals.validated?.body as SearchQueryInput;
      const result = await this.searchService.search(req.user.id, body);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, next);
    }
  }
}
