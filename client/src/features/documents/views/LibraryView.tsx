import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { DocumentFormat, DocumentStatus } from '@documind/shared';
import { ChunkInspectorDrawer } from '../components/ChunkInspectorDrawer';
import { DeleteDocumentDialog } from '../components/DeleteDocumentDialog';
import { DocumentTable } from '../components/DocumentTable';
import { UploadDropzone } from '../components/UploadDropzone';
import {
  useDocumentsQuery,
  useProcessingEvents,
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

  useProcessingEvents();

  const openInspector = useDocumentUploadStore((s) => s.openInspector);
  const openDeleteDialog = useDocumentUploadStore((s) => s.openDeleteDialog);

  const documentsQuery = useDocumentsQuery({
    page,
    limit: DEFAULT_PAGE_LIMIT,
    ...(fileTypeFilter !== 'all' ? { fileType: fileTypeFilter } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  });

  const uploadMutation = useUploadDocumentsMutation();

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    void uploadMutation.mutateAsync(files).catch(() => {
      // Handled inside useUploadDocumentsMutation onError
    });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFileTypeFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  return (
    <>
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-20">
        <div className="flex flex-col gap-1">
          <h1 className="font-t00 text-t00 text-on-surface tracking-tight text-balance">
            Document Repository &amp; Ingestion Hub
          </h1>
          <p className="font-t04 text-t04 text-on-surface-variant text-pretty">
            Upload multi-format corporate files, monitor BullMQ extraction stages, and inspect verified coordinate chunks.
          </p>
        </div>

        <div className="flex items-center gap-15 shrink-0">
          <button
            type="button"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 px-20 py-15 min-h-[48px] rounded-md bg-secondary text-on-secondary font-t03 text-t03 hover:bg-primary hover:text-on-primary active:scale-[0.98] transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus focus-visible:ring-offset-2 disabled:opacity-60"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>Upload Documents</span>
          </button>
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
