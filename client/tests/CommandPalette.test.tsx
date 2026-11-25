import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommandPalette } from '../src/components/layout/CommandPalette';
import { useSearchStore } from '../src/features/search/store/searchStore';

function renderPalette() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/library']}>
        <CommandPalette />
        <Routes>
          <Route path="/library" element={<div>Library Page</div>} />
          <Route path="/search" element={<div>Search Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CommandPalette (Cmd/Ctrl + K)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useSearchStore.setState({ isCommandPaletteOpen: false });
  });

  it('opens on Ctrl+K and navigates to /search?q=... on Enter', async () => {
    const user = userEvent.setup();
    renderPalette();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog', { name: /Quick search command palette/i })).toBeInTheDocument();

    const input = screen.getByLabelText(/Quick search documents and clauses/i);
    await user.type(input, 'revenue{Enter}');

    expect(screen.getByText('Search Page')).toBeInTheDocument();
    expect(useSearchStore.getState().isCommandPaletteOpen).toBe(false);
  });
});
