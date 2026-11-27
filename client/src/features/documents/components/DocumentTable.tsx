import { Link } from 'react-router-dom';
import { AlertTriangle, FolderOpen, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
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
  isError?: boolean;
  onRetry?: () => void;
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
  isError = false,
  onRetry,
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
      className="bg-surface border border-outline rounded-md flex flex-col"
    >
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 border-b border-outline">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1 max-w-sm">
            <label htmlFor="doc-search-input" className="sr-only">
              Search documents by title
            </label>
            <Search
              className="w-3.5 h-3.5 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="doc-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter by title..."
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-surface border border-outline text-on-surface placeholder:text-on-surface-variant font-t04 text-t04 focus:outline-none focus:border-outline-focus focus:ring-1 focus:ring-outline-focus"
            />
          </div>

          <div className="sm:w-36">
            <label htmlFor="format-filter" className="sr-only">
              Filter by format
            </label>
            <select
              id="format-filter"
              value={fileTypeFilter}
              onChange={(e) =>
                onFileTypeChange(e.target.value as DocumentFormat | 'all')
              }
              className="w-full px-2.5 py-1.5 rounded-md bg-surface border border-outline text-on-surface font-t04 text-t04 focus:outline-none focus:border-outline-focus focus:ring-1 focus:ring-outline-focus"
            >
              <option value="all">All Formats</option>
              <option value="pdf">PDF</option>
              <option value="docx">Word (DOCX)</option>
              <option value="xlsx">Excel (XLSX)</option>
              <option value="pptx">PowerPoint (PPTX)</option>
            </select>
          </div>

          <div className="sm:w-36">
            <label htmlFor="status-filter" className="sr-only">
              Filter by status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) =>
                onStatusChange(e.target.value as DocumentStatus | 'all')
              }
              className="w-full px-2.5 py-1.5 rounded-md bg-surface border border-outline text-on-surface font-t04 text-t04 focus:outline-none focus:border-outline-focus focus:ring-1 focus:ring-outline-focus"
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
          {visibleDocs.length} of {totalItems} documents
        </span>
      </div>

      {/* Content states: Loading / Error / True Empty / Filter Empty / Table */}
      {isLoading ? (
        <div className="divide-y divide-outline">
          {SKELETON_ROWS.map((row) => (
            <div key={row} className="p-3.5 flex items-center justify-between gap-4 animate-pulse">
              <div className="h-4 w-56 bg-surface-subtle rounded" />
              <div className="h-4 w-24 bg-surface-subtle rounded" />
              <div className="h-4 w-20 bg-surface-subtle rounded" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="m-3.5 bg-status-failed-bg border border-status-failed-border rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-status-failed-text">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <span className="font-t04 text-t04 font-semibold">Unable to load documents</span>
              <span className="font-t05 text-t05 font-normal">
                Check your connection or try refreshing the list.
              </span>
            </div>
          </div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface border border-outline text-on-surface hover:bg-surface-subtle font-t05 text-t05 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Retry</span>
            </button>
          ) : null}
        </div>
      ) : visibleDocs.length === 0 ? (
        <div className="py-12 px-5 flex flex-col items-center justify-center text-center gap-3">
          <span className="w-10 h-10 rounded-md bg-surface-subtle text-on-surface-variant flex items-center justify-center">
            <FolderOpen className="w-5 h-5" aria-hidden="true" />
          </span>
          {hasActiveFilters ? (
            <>
              <div className="flex flex-col gap-1">
                <h3 className="font-t04 text-t04 font-semibold text-on-surface">
                  No documents match your filters
                </h3>
                <p className="font-t05 text-t05 text-on-surface-variant font-normal">
                  Try adjusting your search term, format, or status filter.
                </p>
              </div>
              <button
                type="button"
                onClick={onClearFilters}
                className="px-3.5 py-1.5 rounded-md border border-outline bg-surface text-on-surface hover:bg-surface-subtle font-t04 text-t04-medium transition-colors duration-instant ease-instant"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1 max-w-sm">
                <h3 className="font-t04 text-t04 font-semibold text-on-surface">
                  No documents yet
                </h3>
                <p className="font-t05 text-t05 text-on-surface-variant font-normal text-pretty">
                  Upload a PDF, Word, Excel, or PowerPoint file above to search and chat with its contents.
                </p>
              </div>
              <button
                type="button"
                onClick={onUploadClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-secondary text-on-secondary hover:bg-primary font-t04 text-t04-medium transition-colors duration-instant ease-instant"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Upload Documents</span>
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline bg-surface-subtle/60">
                  <th scope="col" className="px-3.5 py-2.5 font-t05 text-t05 text-on-surface-variant whitespace-nowrap">
                    Document
                  </th>
                  <th scope="col" className="px-3.5 py-2.5 font-t05 text-t05 text-on-surface-variant whitespace-nowrap">
                    Format
                  </th>
                  <th scope="col" className="px-3.5 py-2.5 font-t05 text-t05 text-on-surface-variant whitespace-nowrap">
                    Sections
                  </th>
                  <th scope="col" className="px-3.5 py-2.5 font-t05 text-t05 text-on-surface-variant whitespace-nowrap">
                    Size
                  </th>
                  <th scope="col" className="px-3.5 py-2.5 font-t05 text-t05 text-on-surface-variant whitespace-nowrap">
                    Status
                  </th>
                  <th scope="col" className="px-3.5 py-2.5 font-t05 text-t05 text-on-surface-variant whitespace-nowrap">
                    Uploaded
                  </th>
                  <th scope="col" className="px-3.5 py-2.5 font-t05 text-t05 text-on-surface-variant text-right whitespace-nowrap">
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
                    <td className="px-3.5 py-2.5 font-t05 text-t05 text-on-surface-variant tabular-nums whitespace-nowrap">
                      {doc.chunkCount}
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
