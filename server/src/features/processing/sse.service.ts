import { EventEmitter } from 'node:events';
import type { JobStage, JobStatus } from '@documind/shared';

export interface ProcessingProgressEvent {
  jobId: string;
  documentId: string;
  userId: string;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  errorLog?: string;
}

export type ProgressListener = (event: ProcessingProgressEvent) => void;

/**
 * In-process Server-Sent Events event bus scoped strictly by userId (and optional jobId).
 */
export class SseService {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  emitProgress(event: ProcessingProgressEvent): void {
    this.emitter.emit(`user:${event.userId}`, event);
  }

  subscribe(
    userId: string,
    listener: ProgressListener,
    jobId?: string
  ): () => void {
    const channel = `user:${userId}`;
    const wrapped: ProgressListener = (event) => {
      if (jobId && event.jobId !== jobId) {
        return;
      }
      listener(event);
    };

    this.emitter.on(channel, wrapped);
    return () => {
      this.emitter.off(channel, wrapped);
    };
  }
}

export const sseService = new SseService();
