import type { NextFunction, Request, Response } from 'express';
import type { PaginationQuery } from '@documind/shared';
import { BaseController } from '../../core/controllers/BaseController.js';
import { UnauthorizedError } from '../../core/errors/AppError.js';
import type { JobService } from './job.service.js';
import type { SseService } from './sse.service.js';

/**
 * HTTP and SSE controller for background ingestion job monitoring and retries.
 */
export class JobController extends BaseController {
  constructor(
    private readonly jobService: JobService,
    private readonly sseService: SseService
  ) {
    super();
  }

  async listJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const query = (res.locals.validated?.query as PaginationQuery | undefined) ?? {
        page: 1,
        limit: 20,
      };
      const result = await this.jobService.listJobs(req.user.id, query);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, next);
    }
  }

  async retryJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const params = res.locals.validated?.params as { id: string } | undefined;
      const jobId = params?.id ?? String(req.params.id);
      const job = await this.jobService.retryJob(jobId, req.user.id);
      this.handleSuccess(res, { job }, 'Job re-queued for background extraction.');
    } catch (error) {
      this.handleError(error, next);
    }
  }

  streamEvents(req: Request, res: Response, next: NextFunction): void {
    this.openProgressStream(req, res, next);
  }

  streamJobProgress(req: Request, res: Response, next: NextFunction): void {
    const params = res.locals.validated?.params as { id: string } | undefined;
    const jobId = params?.id ?? String(req.params.id);
    this.openProgressStream(req, res, next, jobId);
  }

  private openProgressStream(
    req: Request,
    res: Response,
    next: NextFunction,
    jobId?: string
  ): void {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(`event: connected\ndata: ${JSON.stringify({ connected: true })}\n\n`);

    const unsubscribe = this.sseService.subscribe(
      req.user.id,
      (event) => {
        res.write(`event: progress\ndata: ${JSON.stringify(event)}\n\n`);
      },
      jobId
    );

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  }
}
