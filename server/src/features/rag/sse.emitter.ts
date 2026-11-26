import type { Response } from 'express';
import type { CitationDTO } from '@documind/shared';

export type RagSseEventType = 'token' | 'citation' | 'error' | 'done';

export interface RagSseTokenData {
  text: string;
}

export type RagSseCitationData = CitationDTO;

export interface RagSseErrorData {
  code: string;
  message: string;
}

export interface RagSseDoneData {
  complete: true;
  sessionId: string;
  messageId: string;
}

export type RagSseEmitFn = (event: RagSseEventType, data: unknown) => void;

/**
 * Sets standard Server-Sent Events headers on an Express response and flushes them.
 */
export function initSseStream(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

/**
 * Writes a single formatted SSE event (`event: <type>\ndata: <json>\n\n`)
 * if the response stream is still open.
 */
export function writeSseEvent(res: Response, event: RagSseEventType, data: unknown): void {
  if (res.writableEnded || res.destroyed) {
    return;
  }
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
