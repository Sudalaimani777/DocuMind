import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import type { DocumentDTO } from '@documind/shared';
import { FormatIcon } from '../../documents/components/FormatBadge';

interface BrowseDocumentsFeedProps {
  documents: DocumentDTO[];
  isLoading: boolean;
  isError?: boolean;
  hasActiveFilters: boolean;
  onScopeDocument?: (documentId: string) => void;
  onResetFilters: () => void;
  onRetry?: () => void;
}

/**
 * Displays completed documents matching active format/date filters when the search query is empty.
 */
export function BrowseDocumentsFeed({
  documents,
  isLoading,
  isError = false,
  hasActiveFilters,
  onResetFilters,
  onRetry,
}: BrowseDocumentsFeedProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-15" aria-busy="true" aria-label="Loading filtered documents">
        {[0, 1].map((idx) => (
          <div
            key={idx}
            className="bg-surface border border-outline rounded-card p-20 flex flex-col gap-15 animate-pulse"
          >
            <div className="h-5 w-1/3 bg-surface-subtle rounded-md" />
            <div className="h-3 w-1/4 bg-surface-subtle rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="bg-status-failed-bg border border-status-failed-border rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
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
    );
  }

  if (documents.length === 0) {
    return (
      <div className="bg-surface border border-outline rounded-md py-12 px-5 flex flex-col items-center text-center gap-3">
        <span className="w-10 h-10 rounded-md bg-surface-accent-subtle text-secondary flex items-center justify-center">
          <Sparkles className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1 max-w-sm">
          <h2 className="font-t04 text-t04 font-semibold text-on-surface">
            {hasActiveFilters ? 'No matching documents found' : 'Search your documents'}
          </h2>
          <p className="font-t05 text-t05 text-on-surface-variant font-normal">
            {hasActiveFilters
              ? 'No completed documents match the selected filters.'
              : 'Upload files in Documents to search phrases or browse them here.'}
          </p>
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onResetFilters}
            className="px-3.5 py-1.5 rounded-md border border-outline bg-surface text-on-surface hover:bg-surface-subtle font-t04 text-t04-medium"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-15 px-1">
        <span className="font-t04 text-t04-medium text-on-surface tabular-nums">
          {documents.length} indexed {documents.length === 1 ? 'document' : 'documents'} matching
          filters
        </span>
      </div>
      <div className="flex flex-col gap-15">
        {documents.map((doc) => (
          <article
            key={doc.id}
            className="bg-surface border border-outline rounded-card p-20 flex flex-col gap-15 hover:shadow-sm hover:border-outline-focus transition-[border-color,box-shadow] duration-standard ease-standard"
          >
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-15">
              <div className="flex items-center gap-2 min-w-0">
                <FormatIcon fileType={doc.fileType} />
                <h3 className="font-t03 text-t03 text-on-surface truncate">
                  {doc.title || doc.originalFilename}
                </h3>
              </div>
              <span className="font-mono text-mono-sm text-status-ready-text tabular-nums shrink-0">
                {doc.chunkCount} chunks
              </span>
            </header>
            <footer className="flex flex-wrap items-center justify-between gap-15 pt-15 border-t border-outline">
              <p className="font-t05 text-t05 text-on-surface-variant">
                {doc.originalFilename} · {doc.fileType.toUpperCase()}
              </p>
              <Link
                to={`/chat/${doc.id}`}
                className="inline-flex items-center gap-1 font-t04 text-t04-medium text-secondary hover:underline rounded-xs"
              >
                <span>Ask AI About This Document →</span>
              </Link>
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}
