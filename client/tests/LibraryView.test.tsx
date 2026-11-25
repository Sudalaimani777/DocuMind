import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import type { DocumentDTO } from '@documind/shared';
import { LibraryView } from '../src/features/documents/views/LibraryView';
import { useAuthStore } from '../src/core/store/authStore';
import { useDocumentUploadStore } from '../src/features/documents/stores/useDocumentUploadStore';
import { apiClient } from '../src/core/api/client';

function renderLibrary() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/library']}>
        <LibraryView />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const SAMPLE_DOC: DocumentDTO = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: 'user-1',
  title: 'Enterprise Addendum',
  originalFilename: 'Enterprise_Addendum.pdf',
  fileType: 'pdf',
  fileSize: 2048000,
  status: 'completed',
  chunkCount: 12,
  storageUrl: 'https://res.cloudinary.com/demo/raw/upload/doc.pdf',
  createdAt: '2026-11-25T10:00:00.000Z',
};

describe('LibraryView (Document Repository & Ingestion Hub)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'user-1',
        name: 'Alice',
        organization: 'Acme Corp',
        email: 'alice@example.com',
        createdAt: '2026-11-25T00:00:00.000Z',
      },
      isAuthenticated: true,
      isCheckingAuth: false,
      hasCheckedAuth: true,
    });
    useDocumentUploadStore.setState({
      queue: [],
      duplicateNotice: null,
      inspectedDocumentId: null,
      deleteTarget: null,
    });
  });

  it('renders Empty Vault State with zero dummy data when repository is empty', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          items: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, limit: 20 },
        },
        timestamp: '2026-11-25T00:00:00.000Z',
      },
    });

    renderLibrary();

    expect(await screen.findByText(/no documents uploaded yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Duplicate detected/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/FY26_AWS_Enterprise_Addendum/i)).not.toBeInTheDocument();
  });

  it('renders documents from API, filters by title, and shows filter empty state', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          items: [SAMPLE_DOC],
          pagination: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 20 },
        },
        timestamp: '2026-11-25T00:00:00.000Z',
      },
    });

    renderLibrary();

    expect(await screen.findByText('Enterprise_Addendum.pdf')).toBeInTheDocument();
    expect(screen.getByText('12 chunks')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/search documents by title/i);
    await user.type(searchInput, 'nonexistent-query');

    expect(await screen.findByText(/no documents match your current filters/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(await screen.findByText('Enterprise_Addendum.pdf')).toBeInTheDocument();
  });

  it('opens ChunkInspectorDrawer with real coordinates and closes on Escape', async () => {
    const user = userEvent.setup();
    const getSpy = vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
      if (url === '/documents') {
        return {
          data: {
            success: true,
            data: {
              items: [SAMPLE_DOC],
              pagination: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 20 },
            },
            timestamp: '2026-11-25T00:00:00.000Z',
          },
        };
      }
      return {
        data: {
          success: true,
          data: {
            document: SAMPLE_DOC,
            chunks: [
              {
                id: 'chunk-1',
                documentId: SAMPLE_DOC.id,
                chunkIndex: 0,
                content: 'Provider liability cap shall not exceed 2x fees.',
                coordinates: { pageNumber: 14 },
              },
            ],
          },
          timestamp: '2026-11-25T00:00:00.000Z',
        },
      };
    });

    renderLibrary();

    const inspectBtn = await screen.findByRole('button', { name: /inspect/i });
    await user.click(inspectBtn);

    expect(await screen.findByText('Page 14')).toBeInTheDocument();
    expect(
      screen.getByText('Provider liability cap shall not exceed 2x fees.')
    ).toBeInTheDocument();
    expect(getSpy).toHaveBeenCalledWith(`/documents/${SAMPLE_DOC.id}`);

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('confirms deletion via DeleteDocumentDialog and calls DELETE /documents/:id', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [SAMPLE_DOC],
          pagination: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 20 },
        },
        timestamp: '2026-11-25T00:00:00.000Z',
      },
    });
    const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
      data: {
        success: true,
        data: { deletedId: SAMPLE_DOC.id },
        timestamp: '2026-11-25T00:00:00.000Z',
      },
    });

    renderLibrary();

    const deleteBtn = await screen.findByRole('button', {
      name: `Delete ${SAMPLE_DOC.originalFilename}`,
    });
    await user.click(deleteBtn);

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /delete permanently/i }));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(`/documents/${SAMPLE_DOC.id}`);
    });
  });

  it('shows DuplicateAlert only when upload returns 409 Conflict', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [],
          pagination: { totalItems: 0, totalPages: 1, currentPage: 1, limit: 20 },
        },
        timestamp: '2026-11-25T00:00:00.000Z',
      },
    });

    const conflictErr = new AxiosError(
      'Conflict',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 409,
        statusText: 'Conflict',
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'This file has already been uploaded.',
            details: { originalFilename: 'duplicate.pdf' },
          },
          timestamp: '2026-11-25T00:00:00.000Z',
        },
      }
    );
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(conflictErr);

    renderLibrary();

    const input = document.getElementById('dropzone-file-input') as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'duplicate.pdf', { type: 'application/pdf' });
    await user.upload(input, file);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/duplicate detected:/i)).toBeInTheDocument();
    expect(within(alert).getByText('duplicate.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /dismiss duplicate alert/i }));
    expect(screen.queryByText(/duplicate detected:/i)).not.toBeInTheDocument();
  });
});
