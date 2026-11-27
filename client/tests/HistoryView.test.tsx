import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ChatMessageDTO, ChatSessionDTO } from '@documind/shared';
import { HistoryView } from '../src/features/chat-history/views/HistoryView';
import * as chatApi from '../src/features/chat/api/chat.api';

const SAMPLE_SESSIONS: ChatSessionDTO[] = [
  {
    id: 'sess-global-1',
    userId: 'user-1',
    documentId: null,
    documentTitle: null,
    title: 'Q3 Revenue Summary Across Reports',
    messageCount: 6,
    createdAt: '2026-11-25T09:00:00.000Z',
    updatedAt: '2026-11-25T10:30:00.000Z',
  },
  {
    id: 'sess-doc-2',
    userId: 'user-1',
    documentId: 'doc-1111-2222',
    documentTitle: 'Master Services Agreement',
    title: 'Liability Cap Clauses',
    messageCount: 1,
    createdAt: '2026-11-24T14:00:00.000Z',
    updatedAt: '2026-11-24T15:45:00.000Z',
  },
];

const SAMPLE_MESSAGES: ChatMessageDTO[] = [
  {
    id: 'msg-1',
    sessionId: 'sess-global-1',
    role: 'user',
    content: 'What was Q3 revenue?',
    citations: [],
    createdAt: '2026-11-25T10:00:00.000Z',
  },
  {
    id: 'msg-2',
    sessionId: 'sess-global-1',
    role: 'assistant',
    content: 'Q3 revenue grew 24% YoY across EMEA and North America [1].',
    citations: [
      {
        index: 1,
        badge: '[Q3_Report.pdf · p.4]',
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        documentTitle: 'Q3_Report.pdf',
        fileType: 'pdf',
        similarity: 0.94,
        coordinates: { pageNumber: 4 },
        excerpt: 'Q3 revenue grew 24% YoY.',
      },
    ],
    createdAt: '2026-11-25T10:00:05.000Z',
  },
];

function LocationSpy() {
  const location = useLocation();
  return <div data-testid="navigated-location">{`${location.pathname}${location.search}`}</div>;
}

function renderHistoryView(initialEntry = '/history') {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/history" element={<HistoryView />} />
          <Route path="/chat" element={<LocationSpy />} />
          <Route path="/chat/:documentId" element={<LocationSpy />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HistoryView (Stitch Two-Column Chat History)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(chatApi, 'fetchChatMessages').mockResolvedValue(SAMPLE_MESSAGES);
  });

  it('renders session list with title, scope pills, message count, timestamp, and Session Preview', async () => {
    vi.spyOn(chatApi, 'fetchChatSessions').mockResolvedValue({
      sessions: SAMPLE_SESSIONS,
      pagination: {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        limit: 20,
      },
    });

    renderHistoryView();

    expect(
      (await screen.findAllByText('Q3 Revenue Summary Across Reports')).length
    ).toBeGreaterThan(0);
    expect(screen.getByText('Liability Cap Clauses')).toBeInTheDocument();

    // Scope pills
    expect(screen.getAllByText('All Documents').length).toBeGreaterThan(0);
    expect(screen.getByText('Master Services Agreement')).toBeInTheDocument();

    // Message counts
    expect(screen.getAllByText(/6 messages/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 message\b/i)).toBeInTheDocument();

    const timeElements = document.querySelectorAll('time');
    expect(timeElements.length).toBeGreaterThanOrEqual(2);
  });

  it('filters sessions by scope tab and search input', async () => {
    const user = userEvent.setup();
    vi.spyOn(chatApi, 'fetchChatSessions').mockResolvedValue({
      sessions: SAMPLE_SESSIONS,
      pagination: {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        limit: 20,
      },
    });

    renderHistoryView();
    await screen.findByText('Liability Cap Clauses');

    await user.click(screen.getByRole('tab', { name: /Single Document/i }));
    expect(screen.queryByText('Q3 Revenue Summary Across Reports')).not.toBeInTheDocument();
    expect(screen.getAllByText('Liability Cap Clauses').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: /All Chats/i }));
    const searchInput = screen.getByPlaceholderText(/Filter conversations/i);
    await user.type(searchInput, 'Revenue');
    expect(screen.queryByText('Liability Cap Clauses')).not.toBeInTheDocument();
    expect(screen.getAllByText('Q3 Revenue Summary Across Reports').length).toBeGreaterThan(0);
  });

  it('navigates to /chat?sessionId=<id> and /chat/<documentId>?sessionId=<id> when clicking Resume Thread', async () => {
    const user = userEvent.setup();
    vi.spyOn(chatApi, 'fetchChatSessions').mockResolvedValue({
      sessions: SAMPLE_SESSIONS,
      pagination: {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        limit: 20,
      },
    });

    const { unmount } = renderHistoryView();

    await screen.findByText('Liability Cap Clauses');
    await user.click(
      screen.getByRole('button', { name: /Resume Q3 Revenue Summary Across Reports/i })
    );
    expect(await screen.findByTestId('navigated-location')).toHaveTextContent(
      '/chat?sessionId=sess-global-1'
    );

    unmount();

    renderHistoryView();
    await screen.findByText('Liability Cap Clauses');
    await user.click(
      screen.getByRole('button', { name: /Resume Liability Cap Clauses/i })
    );

    expect(await screen.findByTestId('navigated-location')).toHaveTextContent(
      '/chat/doc-1111-2222?sessionId=sess-doc-2'
    );
  });

  it('opens confirmation dialog, deletes session on confirm, and renders empty state when no sessions remain', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(chatApi, 'fetchChatSessions')
      .mockResolvedValueOnce({
        sessions: [SAMPLE_SESSIONS[0]!],
        pagination: {
          totalItems: 1,
          totalPages: 1,
          currentPage: 1,
          limit: 20,
        },
      })
      .mockResolvedValueOnce({
        sessions: [],
        pagination: {
          totalItems: 0,
          totalPages: 1,
          currentPage: 1,
          limit: 20,
        },
      });
    const deleteSpy = vi.spyOn(chatApi, 'deleteChatSession').mockResolvedValue(undefined);

    renderHistoryView();

    await screen.findAllByText('Q3 Revenue Summary Across Reports');
    const deleteBtn = screen.getByRole('button', {
      name: /delete.*Q3 Revenue Summary Across Reports/i,
    });
    await user.click(deleteBtn);

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/Q3 Revenue Summary Across Reports/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Delete Session/i }));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('sess-global-1');
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText(/No conversations yet/i)).toBeInTheDocument();
  });

  it('renders pagination controls when totalPages > 1 and loads the next page', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(chatApi, 'fetchChatSessions')
      .mockResolvedValueOnce({
        sessions: [SAMPLE_SESSIONS[0]!],
        pagination: {
          totalItems: 25,
          totalPages: 2,
          currentPage: 1,
          limit: 20,
        },
      })
      .mockResolvedValueOnce({
        sessions: [SAMPLE_SESSIONS[1]!],
        pagination: {
          totalItems: 25,
          totalPages: 2,
          currentPage: 2,
          limit: 20,
        },
      });

    renderHistoryView();

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
    });
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
  });
});
