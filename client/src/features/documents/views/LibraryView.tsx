import { useRef, useState } from 'react';
import type { DocumentFormat, DocumentStatus } from '@documind/shared';
import { ChunkInspectorDrawer } from '../components/ChunkInspectorDrawer';
import { DeleteDocumentDialog } from '../components/DeleteDocumentDialog';
import { DocumentTable } from '../components/DocumentTable';
import { UploadDropzone } from '../components/UploadDropzone';
import {
  useDocumentsQuery,
  useUploadDocumentsMutation,
} from '../hooks/useDocuments';
import { useDocumentUploadStore } from '../stores/useDocumentUploadStore';

const DEFAULT_PAGE_LIMIT = 20;

/**
 * Document Repository & Ingestion Hub (/library).
 */
export function LibraryView() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState<DocumentFormat | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');

  const openInspector = useDocumentUploadStore((s) => s.openInspector);
  const openDeleteDialog = useDocumentUploadStore((s) => s.openDeleteDialog);

  const documentsQuery = useDocumentsQuery({
    page,
    limit: DEFAULT_PAGE_LIMIT,
    ...(fileTypeFilter !== 'all' ? { fileType: fileTypeFilter } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  });

  const uploadMutation = useUploadDocumentsMutation();

  const handleFilesSelected = async (files: File[]): Promise<boolean> => {
    if (files.length === 0) return true;
    try {
      await uploadMutation.mutateAsync(files);
      return true;
    } catch {
      // Handled inside useUploadDocumentsMutation onError
      return false;
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFileTypeFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  return (
    <>
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-15">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-t01 text-t01 text-on-surface tracking-tight text-balance">
            Documents
          </h1>
          <p className="font-t04 text-t04 text-on-surface-variant text-pretty">
            Upload PDF, Word, Excel, or PowerPoint files to search and ask questions.
          </p>
        </div>

        <div className="flex items-center gap-15 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.pptx"
            className="sr-only"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length > 0) handleFilesSelected(picked);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      <UploadDropzone
        onFilesSelected={handleFilesSelected}
        isUploading={uploadMutation.isPending}
      />

      <DocumentTable
        documents={documentsQuery.data?.items ?? []}
        totalItems={documentsQuery.data?.pagination.totalItems ?? 0}
        page={documentsQuery.data?.pagination.currentPage ?? page}
        totalPages={documentsQuery.data?.pagination.totalPages ?? 1}
        isLoading={documentsQuery.isLoading}
        isError={documentsQuery.isError}
        onRetry={() => void documentsQuery.refetch()}
        searchQuery={searchQuery}
        fileTypeFilter={fileTypeFilter}
        statusFilter={statusFilter}
        onSearchChange={setSearchQuery}
        onFileTypeChange={(value) => {
          setFileTypeFilter(value);
          setPage(1);
        }}
        onStatusChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
        onPageChange={setPage}
        onClearFilters={handleClearFilters}
        onInspect={openInspector}
        onDelete={openDeleteDialog}
        onUploadClick={() => fileInputRef.current?.click()}
      />

      <ChunkInspectorDrawer />
      <DeleteDocumentDialog />
    </>
  );
}
export default LibraryView;
