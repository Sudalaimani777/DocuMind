import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SearchResponseDTO } from '@documind/shared';
import { SearchView } from '../src/features/search/views/SearchView';
import { useSearchStore } from '../src/features/search/store/searchStore';
import { apiClient } from '../src/core/api/client';

function renderSearchView(initialEntry = '/search') {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <SearchView />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const SAMPLE_RESPONSE: SearchResponseDTO = {
  query: 'indemnity cap',
  mode: 'hybrid',
  activeMode: 'hybrid',
  degraded: false,
  totalResults: 1,
  tookMs: 42,
  results: [
    {
      chunkId: 'chunk-1',
      documentId: '11111111-1111-4111-8111-111111111111',
      documentTitle: 'Enterprise Addendum',
      originalFilename: 'Enterprise_Addendum.pdf',
      fileType: 'pdf',
      storageUrl: 'https://res.cloudinary.com/demo/raw/upload/addendum.pdf',
      chunkIndex: 4,
      content: 'Full verbatim clause text for indemnity cap verification.',
      snippet: 'Aggregate <mark>indemnity cap</mark> <script>alert(1)</script> applies.',
      coordinates: { pageNumber: 14 },
      score: 0.032,
      lexicalScore: 0.85,
      semanticScore: 0.91,
      matchType: 'hybrid',
    },
  ],
};

describe('SearchView (Clause & Document Search Engine)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useSearchStore.setState({
      query: '',
      mode: 'hybrid',
      format: undefined,
      startDate: '',
      endDate: '',
      documentId: undefined,
      selectedResult: null,
      isCommandPaletteOpen: false,
    });
  });

  it('renders empty repository prompt with no mock results when query is empty and no documents exist', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [],
          pagination: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 50 },
        },
      },
    });
    renderSearchView('/search');
    await waitFor(() => {
      expect(screen.getByText(/Search your indexed repository/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/FY26_AWS_Enterprise_Addendum/i)).not.toBeInTheDocument();
  });

  it('sanitizes <mark> snippets, renders coordinates, shows degraded banner, and opens SourceChunkDrawer', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        data: { ...SAMPLE_RESPONSE, degraded: true, activeMode: 'keyword' },
      },
    });

    renderSearchView('/search?q=indemnity%20cap');

    await waitFor(() => {
      expect(screen.getByText('Enterprise Addendum')).toBeInTheDocument();
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      /Semantic AI provider is currently unavailable/i
    );
    expect(screen.getByText(/Page 14/)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('mark')?.textContent).toBe('indemnity cap');

    await user.click(screen.getByRole('button', { name: /Inspect Source Clause/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText('Full verbatim clause text for indemnity cap verification.')
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Open Original File/i })[0]).toHaveAttribute(
      'href',
      'https://res.cloudinary.com/demo/raw/upload/addendum.pdf'
    );
  });

  it('renders empty state and clears filters on click', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        data: {
          query: 'missing',
          mode: 'hybrid',
          activeMode: 'hybrid',
          degraded: false,
          totalResults: 0,
          tookMs: 12,
          results: [],
        },
      },
    });

    renderSearchView('/search?q=missing&format=xlsx');

    await waitFor(() => {
      expect(screen.getByText(/No matching clauses found/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Clear filters/i }));
    expect(useSearchStore.getState().format).toBeUndefined();
  });

  it('prompts to select at least one format when all format checkboxes are unchecked', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: SAMPLE_RESPONSE },
    });

    renderSearchView('/search?q=indemnity%20cap');

    await waitFor(() => {
      expect(screen.getByText('Enterprise Addendum')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      await user.click(cb);
    }

    expect(screen.getByText(/Select at least one file format/i)).toBeInTheDocument();
  });

  it('lists matching completed documents when filtering by format checkbox alone without a query', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              userId: 'user-1',
              title: 'airbnb.com brand',
              originalFilename: 'airbnb.com-brand.pdf',
              fileType: 'pdf',
              fileSize: 367100,
              status: 'completed',
              chunkCount: 19,
              storageUrl: 'https://res.cloudinary.com/demo/raw/upload/airbnb.pdf',
              createdAt: '2026-11-25T10:00:00.000Z',
            },
          ],
          pagination: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 50 },
        },
      },
    });

    renderSearchView('/search?format=pdf');

    await waitFor(() => {
      expect(screen.getByText('airbnb.com brand')).toBeInTheDocument();
    });
    expect(screen.getByText('19 chunks')).toBeInTheDocument();
  });
});
