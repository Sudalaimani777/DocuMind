import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ChatMessageDTO, CitationDTO, DocumentDTO } from '@documind/shared';
import { ChatView } from '../src/features/chat/views/ChatView';
import { useChatStore } from '../src/features/chat/store/chatStore';
import * as chatApi from '../src/features/chat/api/chat.api';
import * as documentsApi from '../src/features/documents/api/documents.api';

const SAMPLE_DOCUMENTS: DocumentDTO[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    userId: 'user-1',
    title: 'Q3 Financial Report',
    originalFilename: 'Q3_Report.pdf',
    fileType: 'pdf',
    fileSize: 102400,
    status: 'completed',
    chunkCount: 12,
    storageUrl: 'https://res.cloudinary.com/demo/raw/upload/q3_report.pdf',
    createdAt: '2026-11-25T10:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    userId: 'user-1',
    title: 'Master Services Agreement',
    originalFilename: 'MSA_2026.docx',
    fileType: 'docx',
    fileSize: 51200,
    status: 'completed',
    chunkCount: 8,
    storageUrl: 'https://res.cloudinary.com/demo/raw/upload/msa.docx',
    createdAt: '2026-11-25T11:00:00.000Z',
  },
];

const SAMPLE_CITATION: CitationDTO = {
  index: 1,
  badge: '[Q3_Report.pdf · p.4]',
  chunkId: 'chunk-1',
  documentId: '11111111-1111-4111-8111-111111111111',
  documentTitle: 'Q3 Financial Report',
  fileType: 'pdf',
  similarity: 0.92,
  coordinates: { pageNumber: 4 },
  excerpt:
    'Revenue grew 24% YoY.<script>alert("xss")</script><img src="x" onerror="alert(1)" />',
};

function renderChatView(initialEntry = '/chat') {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/chat" element={<ChatView />} />
          <Route path="/chat/:documentId" element={<ChatView />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ChatView (Stitch Editorial RAG Assistant & Source Verification)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useChatStore.setState({
      activeSessionId: null,
      scopedDocumentId: null,
      messages: [],
      isStreaming: false,
      streamingContent: '',
      streamingCitations: [],
      activeCitation: null,
      streamError: null,
    });

    vi.spyOn(documentsApi, 'fetchDocuments').mockResolvedValue({
      items: SAMPLE_DOCUMENTS,
      pagination: {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        limit: 100,
      },
    });
  });

  it('submits a prompt, streams token + citation + done events, and renders clickable [k] citation links', async () => {
    const user = userEvent.setup();
    const streamSpy = vi
      .spyOn(chatApi, 'streamRagChat')
      .mockImplementation(async (_payload, handlers) => {
        handlers.onToken('Total Q3 revenue ');
        handlers.onToken('increased by 24% [1].');
        handlers.onCitation(SAMPLE_CITATION);
        handlers.onDone({ sessionId: 'sess-123', messageId: 'msg-1' });
      });

    renderChatView('/chat');

    const input = await screen.findByPlaceholderText(
      /Ask a question about your documents/i
    );
    await user.type(input, 'What was Q3 revenue growth?{Enter}');

    await waitFor(() => {
      expect(streamSpy).toHaveBeenCalledTimes(1);
    });

    expect(streamSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'What was Q3 revenue growth?',
      }),
      expect.any(Object),
      expect.any(AbortSignal)
    );

    await waitFor(() => {
      expect(screen.getByText(/Total Q3 revenue increased by 24%/i)).toBeInTheDocument();
    });

    const citationButton = screen.getByRole('button', {
      name: /Inspect citation 1: Q3 Financial Report/i,
    });
    expect(citationButton).toBeInTheDocument();
  });

  it('updates the Source Verification Inspector with sanitized verbatim excerpt when clicking a citation', async () => {
    const user = userEvent.setup();
    vi.spyOn(chatApi, 'streamRagChat').mockImplementation(async (_payload, handlers) => {
      handlers.onToken('Revenue grew 24% [1].');
      handlers.onCitation(SAMPLE_CITATION);
      handlers.onDone({ sessionId: 'sess-123', messageId: 'msg-1' });
    });

    renderChatView('/chat');

    const input = await screen.findByPlaceholderText(
      /Ask a question about your documents/i
    );
    await user.type(input, 'Summarize revenue{Enter}');

    const citationButton = await screen.findByRole('button', {
      name: /Inspect citation 1: Q3 Financial Report/i,
    });
    await user.click(citationButton);

    const drawer = await screen.findByRole('dialog');
    const scoped = within(drawer);
    expect(scoped.getByText('Source Citation [1]')).toBeInTheDocument();
    expect(scoped.getAllByText('Q3 Financial Report').length).toBeGreaterThan(0);
    expect(scoped.getByText('92%')).toBeInTheDocument();
    expect(scoped.getByText('Page 4')).toBeInTheDocument();
    expect(scoped.getByText(/Revenue grew 24% YoY\./i)).toBeInTheDocument();

    // Verify DOMPurify stripped dangerous tags and event attributes
    expect(drawer.querySelector('script')).toBeNull();
    expect(drawer.innerHTML).not.toContain('onerror');
    expect(drawer.innerHTML).not.toContain('alert("xss")');
  });

  it('resets active session when switching to Single Specific Document and selecting a document', async () => {
    const user = userEvent.setup();
    const resetSpy = vi.spyOn(useChatStore.getState(), 'resetForScope');

    useChatStore.setState({
      activeSessionId: 'sess-existing',
      scopedDocumentId: null,
      messages: [
        {
          id: 'm1',
          sessionId: 'sess-existing',
          role: 'user',
          content: 'Existing question',
          citations: [],
          createdAt: '2026-11-26T10:00:00.000Z',
        },
      ],
    });

    renderChatView('/chat');

    const singleTab = await screen.findByRole('tab', {
      name: /Single Document/i,
    });
    await user.click(singleTab);

    const scopeSelect = await screen.findByLabelText(/Document scope/i);
    await screen.findByRole('option', { name: 'Master Services Agreement' });
    await user.selectOptions(scopeSelect, '22222222-2222-4222-8222-222222222222');

    await waitFor(() => {
      expect(resetSpy).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222');
    });
    expect(useChatStore.getState().activeSessionId).toBeNull();
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it('resumes an existing session when ?sessionId= query parameter is present', async () => {
    const existingMessages: ChatMessageDTO[] = [
      {
        id: 'm-1',
        sessionId: 'sess-resume-1',
        role: 'user',
        content: 'What is the cap?',
        citations: [],
        createdAt: '2026-11-26T09:00:00.000Z',
      },
      {
        id: 'm-2',
        sessionId: 'sess-resume-1',
        role: 'assistant',
        content: 'The cap is $1M [1].',
        citations: [SAMPLE_CITATION],
        createdAt: '2026-11-26T09:00:05.000Z',
      },
    ];

    vi.spyOn(chatApi, 'fetchChatMessages').mockResolvedValue(existingMessages);

    renderChatView('/chat?sessionId=sess-resume-1');

    await waitFor(() => {
      expect(screen.getByText('What is the cap?')).toBeInTheDocument();
      expect(screen.getByText(/The cap is \$1M/i)).toBeInTheDocument();
    });
  });

  it('aborts active stream on Stop click, preserves partial tokens, and shows no error alert', async () => {
    const user = userEvent.setup();
    let capturedSignal: AbortSignal | undefined;

    vi.spyOn(chatApi, 'streamRagChat').mockImplementation(
      async (_payload, handlers, signal) => {
        capturedSignal = signal;
        handlers.onToken('Partial streamed answer');
        await new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      }
    );

    renderChatView('/chat');

    const input = await screen.findByPlaceholderText(
      /Ask a question about your documents/i
    );
    await user.type(input, 'Tell me everything{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Partial streamed answer/i)).toBeInTheDocument();
    });

    const stopButton = screen.getByRole('button', { name: /Stop generating/i });
    await user.click(stopButton);

    expect(capturedSignal?.aborted).toBe(true);
    expect(screen.getByText(/Partial streamed answer/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it('initializes /chat/:documentId with Single Specific Document active and passes documentId to streamRagChat', async () => {
    const user = userEvent.setup();
    const docId = '11111111-1111-4111-8111-111111111111';
    const streamSpy = vi
      .spyOn(chatApi, 'streamRagChat')
      .mockImplementation(async (_payload, handlers) => {
        handlers.onToken('Scoped answer.');
        handlers.onDone({ sessionId: 'sess-scoped', messageId: 'msg-scoped' });
      });

    renderChatView(`/chat/${docId}`);

    const scopeSelect = (await screen.findByLabelText(/Document scope/i)) as HTMLSelectElement;
    await screen.findByRole('option', { name: 'Q3 Financial Report' });
    expect(scopeSelect.value).toBe(docId);

    const input = screen.getByPlaceholderText(/Ask a question about your documents/i);
    await user.type(input, 'What is inside this report?{Enter}');

    await waitFor(() => {
      expect(streamSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'What is inside this report?',
          documentId: docId,
        }),
        expect.any(Object),
        expect.any(AbortSignal)
      );
    });
  });

  it('renders Markdown bold, bullet lists, inline code, and grouped [1, 2] citations without infinite-looping', async () => {
    const secondCitation: CitationDTO = {
      ...SAMPLE_CITATION,
      index: 2,
      chunkId: 'chunk-2',
      documentTitle: 'Master Services Agreement',
    };

    vi.spyOn(chatApi, 'fetchChatMessages').mockResolvedValue([
      {
        id: 'm-md-1',
        sessionId: 'sess-md-1',
        role: 'user',
        content: 'What are the colors?',
        citations: [],
        createdAt: '2026-11-26T09:00:00.000Z',
      },
      {
        id: 'm-md-2',
        sessionId: 'sess-md-1',
        role: 'assistant',
        content:
          '**Primary Colors:**\n* **Primary:** `#FF385C` [1, 2]\n* *Secondary:* `#E00B41`',
        citations: [SAMPLE_CITATION, secondCitation],
        createdAt: '2026-11-26T09:00:05.000Z',
      },
    ]);

    renderChatView('/chat?sessionId=sess-md-1');

    expect(await screen.findByText('Primary Colors:')).toBeInTheDocument();
    expect(screen.getByText('#FF385C').tagName).toBe('CODE');
    expect(
      screen.getByRole('button', { name: /Inspect citation 1: Q3 Financial Report/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Inspect citation 2: Master Services Agreement/i })
    ).toBeInTheDocument();
  });
});
