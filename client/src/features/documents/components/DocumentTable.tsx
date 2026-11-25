import { Link } from 'react-router-dom';
import { FolderOpen, Search, Trash2, Upload } from 'lucide-react';
import type { DocumentDTO, DocumentFormat, DocumentStatus } from '@documind/shared';
import { FormatBadge, FormatIcon } from './FormatBadge';
import { StatusBadge } from './StatusBadge';
import { formatFileSize, formatShortDate } from '../utils/formatters';

interface DocumentTableProps {
  documents: DocumentDTO[];
  totalItems: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  searchQuery: string;
  fileTypeFilter: DocumentFormat | 'all';
  statusFilter: DocumentStatus | 'all';
  onSearchChange: (value: string) => void;
  onFileTypeChange: (value: DocumentFormat | 'all') => void;
  onStatusChange: (value: DocumentStatus | 'all') => void;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
  onInspect: (documentId: string) => void;
  onDelete: (doc: DocumentDTO) => void;
  onUploadClick: () => void;
}

const SKELETON_ROWS = [1, 2, 3, 4];

/**
 * User-scoped document catalog table with filtering, pagination, loading skeletons, and empty states.
 */
export function DocumentTable({
  documents,
  totalItems,
  page,
  totalPages,
  isLoading,
  searchQuery,
  fileTypeFilter,
  statusFilter,
  onSearchChange,
  onFileTypeChange,
  onStatusChange,
  onPageChange,
  onClearFilters,
  onInspect,
  onDelete,
  onUploadClick,
}: DocumentTableProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleDocs = normalizedQuery
    ? documents.filter(
        (doc) =>
          doc.title.toLowerCase().includes(normalizedQuery) ||
          doc.originalFilename.toLowerCase().includes(normalizedQuery)
      )
    : documents;

  const hasActiveFilters =
    normalizedQuery.length > 0 || fileTypeFilter !== 'all' || statusFilter !== 'all';

  return (
    <section
      aria-label="Document Catalog"
      className="bg-surface border border-outline rounded-card p-20 flex flex-col gap-20"
    >
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-15">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-15 flex-1">
          <div className="relative flex-1 max-w-md">
            <label htmlFor="doc-search-input" className="sr-only">
              Search documents by title
            </label>
            <Search
              className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="doc-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search documents by title..."
              className="w-full pl-9 pr-3 py-2 rounded-md bg-surface border border-outline text-on-surface placeholder:text-on-surface-variant font-t04 text-t04 focus:outline-none focus:border-outline-focus focus:ring-1 focus:ring-outline-focus"
            />
          </div>

          <div className="sm:w-40">
            <label htmlFor="format-filter" className="sr-only">
              Filter by format
            </label>
            <select
              id="format-filter"
              value={fileTypeFilter}
              onChange={(e) =>
                onFileTypeChange(e.target.value as DocumentFormat | 'all')
              }
              className="w-full px-3 py-2 rounded-md bg-surface border border-outline text-on-surface font-t04 text-t04 focus:outline-none focus:border-outline-focus focus:ring-1 focus:ring-outline-focus"
            >
              <option value="all">All Formats</option>
              <option value="pdf">PDF</option>
              <option value="docx">Word (DOCX)</option>
              <option value="xlsx">Excel (XLSX)</option>
              <option value="pptx">PowerPoint (PPTX)</option>
            </select>
          </div>

          <div className="sm:w-40">
            <label htmlFor="status-filter" className="sr-only">
              Filter by status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) =>
                onStatusChange(e.target.value as DocumentStatus | 'all')
              }
              className="w-full px-3 py-2 rounded-md bg-surface border border-outline text-on-surface font-t04 text-t04 focus:outline-none focus:border-outline-focus focus:ring-1 focus:ring-outline-focus"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Ready</option>
              <option value="processing">Processing</option>
              <option value="pending">Queued</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <span className="font-t05 text-t05 text-on-surface-variant tabular-nums">
          Showing {visibleDocs.length} of {totalItems} documents
        </span>
      </div>

      {/* Content states: Loading / True Empty / Filter Empty / Table */}
      {isLoading ? (
        <div className="border border-outline rounded-md divide-y divide-outline">
          {SKELETON_ROWS.map((row) => (
            <div key={row} className="p-15 flex items-center justify-between gap-15 animate-pulse">
              <div className="h-4 w-56 bg-surface-subtle rounded" />
              <div className="h-4 w-24 bg-surface-subtle rounded" />
              <div className="h-4 w-20 bg-surface-subtle rounded" />
            </div>
          ))}
        </div>
      ) : visibleDocs.length === 0 ? (
        <div className="border border-dashed border-outline rounded-md py-48 px-20 flex flex-col items-center justify-center text-center gap-15">
          <span className="w-12 h-12 rounded-card bg-surface-subtle text-on-surface-variant flex items-center justify-center">
            <FolderOpen className="w-6 h-6" aria-hidden="true" />
          </span>
          {hasActiveFilters ? (
            <>
              <div className="flex flex-col gap-1">
                <h3 className="font-t03 text-t03 text-on-surface">
                  No documents match your current filters
                </h3>
                <p className="font-t04 text-t04 text-on-surface-variant">
                  Try adjusting your search term, format filter, or status filter.
                </p>
              </div>
              <button
                type="button"
                onClick={onClearFilters}
                className="px-20 py-2 rounded-md border border-outline bg-surface text-on-surface hover:bg-surface-subtle font-t04 text-t04-medium transition-colors duration-instant ease-instant"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1 max-w-md">
                <h3 className="font-t03 text-t03 text-on-surface">
                  No documents uploaded yet
                </h3>
                <p className="font-t04 text-t04 text-on-surface-variant text-pretty">
                  Drop a PDF, Word, Excel, or PowerPoint file above to begin indexing chunks and 768-dim vector embeddings.
                </p>
              </div>
              <button
                type="button"
                onClick={onUploadClick}
                className="inline-flex items-center gap-2 px-20 py-2.5 rounded-md bg-secondary text-on-secondary hover:bg-primary hover:text-on-primary font-t04 text-t04-medium transition-colors duration-instant ease-instant"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                <span>Upload Documents</span>
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-outline rounded-md">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline bg-surface-subtle">
                  <th scope="col" className="px-3 py-3 font-t05 text-t05 text-on-surface whitespace-nowrap">
                    Document
                  </th>
                  <th scope="col" className="px-3 py-3 font-t05 text-t05 text-on-surface whitespace-nowrap">
                    Format
                  </th>
                  <th scope="col" className="px-3 py-3 font-t05 text-t05 text-on-surface whitespace-nowrap">
                    Chunks
                  </th>
                  <th scope="col" className="px-3 py-3 font-t05 text-t05 text-on-surface whitespace-nowrap">
                    Size
                  </th>
                  <th scope="col" className="px-3 py-3 font-t05 text-t05 text-on-surface whitespace-nowrap">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-3 font-t05 text-t05 text-on-surface whitespace-nowrap">
                    Uploaded
                  </th>
                  <th scope="col" className="px-3 py-3 font-t05 text-t05 text-on-surface text-right whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {visibleDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-surface-subtle/60 transition-colors duration-instant ease-instant"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <FormatIcon fileType={doc.fileType} />
                        <span
                          title={doc.originalFilename}
                          className="font-t04 text-t04-medium text-on-surface max-w-[220px] truncate"
                        >
                          {doc.originalFilename}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <FormatBadge fileType={doc.fileType} />
                    </td>
                    <td className="px-3 py-3 font-t05 text-t05 text-on-surface-variant tabular-nums whitespace-nowrap">
                      {doc.chunkCount} chunks
                    </td>
                    <td className="px-3 py-3 font-mono text-mono-sm text-on-surface-variant tabular-nums whitespace-nowrap">
                      {formatFileSize(doc.fileSize)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-3 py-3 font-t05 text-t05 text-on-surface-variant tabular-nums whitespace-nowrap">
                      {formatShortDate(doc.createdAt)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/chat/${doc.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface text-on-surface border border-outline hover:bg-surface-subtle font-t05 text-t05 transition-colors duration-instant ease-instant"
                        >
                          Chat
                        </Link>
                        <button
                          type="button"
                          onClick={() => onInspect(doc.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface text-on-surface border border-outline hover:bg-surface-subtle font-t05 text-t05 transition-colors duration-instant ease-instant"
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(doc)}
                          aria-label={`Delete ${doc.originalFilename}`}
                          className="inline-flex items-center justify-center p-1.5 rounded-md text-on-surface-variant hover:text-status-failed-text hover:bg-status-failed-bg transition-colors duration-instant ease-instant"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between pt-2">
              <span className="font-t05 text-t05 text-on-surface-variant tabular-nums">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)}
                  className="px-3 py-1.5 rounded-md border border-outline bg-surface text-on-surface font-t05 text-t05 hover:bg-surface-subtle disabled:opacity-50 disabled:pointer-events-none"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => onPageChange(page + 1)}
                  className="px-3 py-1.5 rounded-md border border-outline bg-surface text-on-surface font-t05 text-t05 hover:bg-surface-subtle disabled:opacity-50 disabled:pointer-events-none"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
