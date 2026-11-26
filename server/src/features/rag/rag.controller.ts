import type { NextFunction, Request, Response } from 'express';
import type { RagChatRequestInput } from '@documind/shared';
import { BaseController } from '../../core/controllers/BaseController.js';
import { AppError, UnauthorizedError } from '../../core/errors/AppError.js';
import type { ContextOrchestrator } from './context.orchestrator.js';
import { initSseStream, writeSseEvent } from './sse.emitter.js';

/**
 * HTTP/SSE controller for streaming grounded RAG responses.
 */
export class RagController extends BaseController {
  constructor(private readonly contextOrchestrator: ContextOrchestrator) {
    super();
  }

  async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      this.handleError(new UnauthorizedError(), next);
      return;
    }

    const body = res.locals.validated?.body as RagChatRequestInput;
    const abortController = new AbortController();
    let streamStarted = false;

    const onClose = () => {
      abortController.abort();
    };
    req.on('close', onClose);

    try {
      await this.contextOrchestrator.execute({
        userId: req.user.id,
        query: body.query,
        sessionId: body.sessionId,
        documentId: body.documentId,
        signal: abortController.signal,
        onStreamStart: () => {
          streamStarted = true;
          initSseStream(res);
        },
        emit: (event, data) => {
          writeSseEvent(res, event, data);
        },
      });

      if (streamStarted && !res.writableEnded) {
        res.end();
      }
    } catch (error) {
      if (!streamStarted) {
        this.handleError(error, next);
        return;
      }

      if (!abortController.signal.aborted) {
        const code = error instanceof AppError ? error.errorCode : 'RAG_STREAM_ERROR';
        const message =
          error instanceof Error ? error.message : 'An unexpected error occurred during streaming.';
        writeSseEvent(res, 'error', { code, message });
      }

      if (!res.writableEnded) {
        res.end();
      }
    } finally {
      req.off('close', onClose);
    }
  }
}
