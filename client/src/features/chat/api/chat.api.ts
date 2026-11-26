import type {
  ApiErrorResponse,
  ApiResponse,
  ChatMessageDTO,
  ChatSessionDTO,
  CitationDTO,
  RagChatRequestInput,
} from '@documind/shared';
import { apiClient } from '../../../core/api/client';

export interface ListChatSessionsParams {
  page?: number;
  limit?: number;
}

export interface PaginatedChatSessionsResponse {
  sessions: ChatSessionDTO[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
}

export interface RagDonePayload {
  sessionId: string;
  messageId?: string;
}

export interface RagStreamHandlers {
  onToken: (token: string) => void;
  onCitation: (citation: CitationDTO) => void;
  onError: (message: string) => void;
  onDone: (payload: RagDonePayload) => void;
}

/**
 * Parses a single raw SSE event block and dispatches it to the matching handler.
 */
function dispatchSseBlock(rawBlock: string, handlers: RagStreamHandlers): void {
  const lines = rawBlock.split('\n');
  let eventName = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith(':') || line.trim().length === 0) {
      continue;
    }
    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return;
  }

  const rawData = dataLines.join('\n');
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    if (eventName === 'token') {
      handlers.onToken(rawData);
    } else if (eventName === 'error') {
      handlers.onError(rawData);
    }
    return;
  }

  if (eventName === 'token') {
    const tokenValue =
      typeof parsed === 'string'
        ? parsed
        : ((parsed as { token?: string; text?: string }).token ??
          (parsed as { token?: string; text?: string }).text ??
          '');
    if (tokenValue.length > 0) {
      handlers.onToken(tokenValue);
    }
    return;
  }

  if (eventName === 'citation') {
    handlers.onCitation(parsed as CitationDTO);
    return;
  }

  if (eventName === 'error') {
    const errObj = parsed as { message?: string; error?: { message?: string } };
    handlers.onError(errObj.message ?? errObj.error?.message ?? 'Streaming failed');
    return;
  }

  if (eventName === 'done') {
    handlers.onDone(parsed as RagDonePayload);
  }
}

/**
 * Streams a grounded RAG response from POST /api/v1/chat/rag via ReadableStream SSE.
 */
export async function streamRagChat(
  payload: RagChatRequestInput,
  handlers: RagStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
  const response = await fetch(`${baseUrl}/chat/rag`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = (await response.json()) as Partial<ApiErrorResponse>;
      if (errorBody.error?.message) {
        message = errorBody.error.message;
      }
    } catch {
      // Fall back to status message when error body is not JSON.
    }
    handlers.onError(message);
    throw new Error(message);
  }

  if (!response.body) {
    const message = 'Streaming response body is unavailable';
    handlers.onError(message);
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');

      let boundaryIndex = buffer.indexOf('\n\n');
      while (boundaryIndex !== -1) {
        const block = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);
        if (block.trim().length > 0) {
          dispatchSseBlock(block, handlers);
        }
        boundaryIndex = buffer.indexOf('\n\n');
      }
    }

    buffer += decoder.decode();
    buffer = buffer.replace(/\r\n/g, '\n');
    if (buffer.trim().length > 0) {
      dispatchSseBlock(buffer, handlers);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Fetches paginated chat sessions owned by the authenticated user.
 */
export async function fetchChatSessions(
  params?: ListChatSessionsParams
): Promise<PaginatedChatSessionsResponse> {
  const response = await apiClient.get<ApiResponse<PaginatedChatSessionsResponse>>(
    '/chat/sessions',
    { params }
  );
  return response.data.data;
}

/**
 * Fetches chronological messages for a specific chat session.
 */
export async function fetchChatMessages(sessionId: string): Promise<ChatMessageDTO[]> {
  const response = await apiClient.get<ApiResponse<{ items: ChatMessageDTO[] }>>(
    `/chat/sessions/${sessionId}/messages`
  );
  return response.data.data.items;
}

/**
 * Deletes a chat session and its persisted messages.
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/chat/sessions/${sessionId}`);
}
