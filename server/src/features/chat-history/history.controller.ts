import type { NextFunction, Request, Response } from 'express';
import type { ChatSessionsQueryInput } from '@documind/shared';
import { BaseController } from '../../core/controllers/BaseController.js';
import { UnauthorizedError } from '../../core/errors/AppError.js';
import type { ChatHistoryService } from './history.service.js';

/**
 * HTTP controller for user-scoped chat session listing, message retrieval, and deletion.
 */
export class HistoryController extends BaseController {
  constructor(private readonly historyService: ChatHistoryService) {
    super();
  }

  async listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }

      const query = (res.locals.validated?.query as ChatSessionsQueryInput | undefined) ?? {
        page: 1,
        limit: 20,
      };
      const result = await this.historyService.listSessions(req.user.id, query);
      this.handleSuccess(res, {
        sessions: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      this.handleError(error, next);
    }
  }

  async getSessionMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }

      const params = res.locals.validated?.params as { id: string } | undefined;
      const sessionId = params?.id ?? String(req.params.id);
      const items = await this.historyService.getSessionMessages(req.user.id, sessionId);

      this.handleSuccess(res, { items });
    } catch (error) {
      this.handleError(error, next);
    }
  }

  async deleteSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }

      const params = res.locals.validated?.params as { id: string } | undefined;
      const sessionId = params?.id ?? String(req.params.id);
      await this.historyService.deleteSession(req.user.id, sessionId);

      this.handleSuccess(res, { deletedId: sessionId }, 'Chat session deleted.');
    } catch (error) {
      this.handleError(error, next);
    }
  }
}
