import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CitationDTO } from '@documind/shared';
import { streamRagChat } from '../src/features/chat/api/chat.api';
import { useChatStore } from '../src/features/chat/store/chatStore';

const makeCitation = (index: number, overrides?: Partial<CitationDTO>): CitationDTO => ({
  index,
  badge: `[${index}]`,
  chunkId: `chunk-${index}`,
  documentId: 'doc-1',
  documentTitle: 'Q3 Financial Report.pdf',
  fileType: 'pdf',
  similarity: 0.92,
  coordinates: { pageNumber: index },
  excerpt: `Excerpt for citation ${index}`,
  ...overrides,
});

describe('useChatStore', () => {
  beforeEach(() => {
    useChatStore.getState().resetForScope(null);
  });

  it('startStream adds an optimistic user message, resets streaming buffers, and sets isStreaming to true', () => {
    useChatStore.setState({
      streamingContent: 'stale content',
      streamingCitations: [makeCitation(1)],
      streamError: 'previous error',
    });

    useChatStore.getState().startStream('What was Q3 revenue?');

    const state = useChatStore.getState();
    expect(state.isStreaming).toBe(true);
    expect(state.streamingContent).toBe('');
    expect(state.streamingCitations).toEqual([]);
    expect(state.streamError).toBeNull();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      role: 'user',
      content: 'What was Q3 revenue?',
      citations: [],
    });
  });

  it('appendToken appends tokens to streamingContent', () => {
    useChatStore.getState().startStream('Summarize');
    useChatStore.getState().appendToken('Revenue ');
    useChatStore.getState().appendToken('grew 14%.');

    expect(useChatStore.getState().streamingContent).toBe('Revenue grew 14%.');
  });

  it('addCitation dedupes citations by index in streamingCitations', () => {
    useChatStore.getState().startStream('Cite sources');
    const first = makeCitation(1, { excerpt: 'First excerpt' });
    const duplicate = makeCitation(1, { excerpt: 'Duplicate excerpt' });
    const second = makeCitation(2, { excerpt: 'Second excerpt' });

    useChatStore.getState().addCitation(first);
    useChatStore.getState().addCitation(duplicate);
    useChatStore.getState().addCitation(second);

    const { streamingCitations } = useChatStore.getState();
    expect(streamingCitations).toHaveLength(2);
    expect(streamingCitations[0]).toEqual(first);
    expect(streamingCitations[1]).toEqual(second);
  });

  it('finishStream appends assistant message with accumulated content and citations, sets activeSessionId, and clears streaming state', () => {
    const citation = makeCitation(1);
    useChatStore.getState().startStream('What is the margin?');
    useChatStore.getState().appendToken('Gross margin is 42% [1].');
    useChatStore.getState().addCitation(citation);

    useChatStore.getState().finishStream('session-123');

    const state = useChatStore.getState();
    expect(state.activeSessionId).toBe('session-123');
    expect(state.isStreaming).toBe(false);
    expect(state.streamingContent).toBe('');
    expect(state.streamingCitations).toEqual([]);
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1]).toMatchObject({
      sessionId: 'session-123',
      role: 'assistant',
      content: 'Gross margin is 42% [1].',
      citations: [citation],
    });
  });

  it('setActiveCitation opens and closes the Citation Inspector Drawer state', () => {
    const citation = makeCitation(1);

    useChatStore.getState().setActiveCitation(citation);
    expect(useChatStore.getState().activeCitation).toEqual(citation);

    useChatStore.getState().setActiveCitation(null);
    expect(useChatStore.getState().activeCitation).toBeNull();
  });

  it('resetForScope clears session, messages, and sets scopedDocumentId', () => {
    useChatStore.getState().startStream('Hello');
    useChatStore.getState().appendToken('Hi');
    useChatStore.getState().addCitation(makeCitation(1));
    useChatStore.getState().finishStream('session-abc');
    useChatStore.getState().setActiveCitation(makeCitation(1));

    useChatStore.getState().resetForScope('doc-999');

    const state = useChatStore.getState();
    expect(state.scopedDocumentId).toBe('doc-999');
    expect(state.activeSessionId).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.isStreaming).toBe(false);
    expect(state.streamingContent).toBe('');
    expect(state.streamingCitations).toEqual([]);
    expect(state.activeCitation).toBeNull();
    expect(state.streamError).toBeNull();
  });

  it('failStream clears streaming buffers, sets isStreaming to false, and records streamError', () => {
    useChatStore.getState().startStream('Will this fail?');
    useChatStore.getState().appendToken('Partial...');
    useChatStore.getState().addCitation(makeCitation(1));

    useChatStore.getState().failStream('Provider timeout');

    const state = useChatStore.getState();
    expect(state.isStreaming).toBe(false);
    expect(state.streamingContent).toBe('');
    expect(state.streamingCitations).toEqual([]);
    expect(state.streamError).toBe('Provider timeout');
  });
});

describe('streamRagChat', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses partial SSE chunks and split CRLF boundaries into token, citation, and done events', async () => {
    const citation = makeCitation(1);
    const encoder = new TextEncoder();
    const chunks = [
      'event: token\r',
      '\ndata: {"token":"Hello "}\r\n\r',
      '\nevent: token\ndata: {"token":"world"}\n\n',
      `event: citation\r\ndata: ${JSON.stringify(citation).slice(0, 25)}`,
      `${JSON.stringify(citation).slice(25)}\r\n\r\n`,
      'event: done\ndata: {"sessionId":"sess-42","messageId":"msg-9"}\n\n',
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: vi.fn(async () => {
        if (chunkIndex < chunks.length) {
          const value = encoder.encode(chunks[chunkIndex++]);
          return { value, done: false as const };
        }
        return { value: undefined, done: true as const };
      }),
      releaseLock: vi.fn(),
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => mockReader,
      },
    } as unknown as Response);

    const tokens: string[] = [];
    const citations: CitationDTO[] = [];
    const errors: string[] = [];
    let donePayload: { sessionId: string; messageId?: string } | null = null;

    await streamRagChat(
      { query: 'Say hello' },
      {
        onToken: (token) => tokens.push(token),
        onCitation: (cit) => citations.push(cit),
        onError: (msg) => errors.push(msg),
        onDone: (payload) => {
          donePayload = payload;
        },
      }
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/chat/rag',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
    expect(tokens).toEqual(['Hello ', 'world']);
    expect(citations).toEqual([citation]);
    expect(errors).toEqual([]);
    expect(donePayload).toEqual({ sessionId: 'sess-42', messageId: 'msg-9' });
  });
});
