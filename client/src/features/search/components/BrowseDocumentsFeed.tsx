import { Link } from 'react-router-dom';
import { ExternalLink, Search, Sparkles } from 'lucide-react';
import type { DocumentDTO } from '@documind/shared';
import { FormatIcon } from '../../documents/components/FormatBadge';

interface BrowseDocumentsFeedProps {
  documents: DocumentDTO[];
  isLoading: boolean;
  hasActiveFilters: boolean;
  onScopeDocument: (documentId: string) => void;
  onResetFilters: () => void;
}

/**
 * Displays completed documents matching active format/date filters when the search query is empty.
 */
export function BrowseDocumentsFeed({
  documents,
  isLoading,
  hasActiveFilters,
  onScopeDocument,
  onResetFilters,
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

  if (documents.length === 0) {
    return (
      <div className="bg-surface border border-outline rounded-card p-32 flex flex-col items-center text-center gap-15">
        <span className="w-12 h-12 rounded-pill bg-surface-accent-subtle text-secondary flex items-center justify-center">
          <Sparkles className="w-5 h-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1 max-w-md">
          <h2 className="font-t02 text-t02 text-on-surface">
            {hasActiveFilters ? 'No matching documents found' : 'Search your indexed repository'}
          </h2>
          <p className="font-t04 text-t04 text-on-surface-variant">
            {hasActiveFilters
              ? 'No completed documents match the selected filters.'
              : 'Upload and process documents in the Document Library, then search clauses or browse them here.'}
          </p>
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onResetFilters}
            className="px-15 py-2 rounded-md border border-outline bg-surface text-on-surface hover:bg-surface-subtle font-t04 text-t04-medium"
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
            <p className="font-t05 text-t05 text-on-surface-variant">
              {doc.originalFilename} · {doc.fileType.toUpperCase()}
            </p>
            <footer className="flex flex-wrap items-center justify-between gap-15 pt-15 border-t border-outline">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onScopeDocument(doc.id)}
                  className="inline-flex items-center gap-1.5 px-15 py-2 rounded-md bg-surface text-on-surface border border-outline hover:bg-surface-subtle font-t05 text-t05 transition-colors duration-instant ease-instant"
                >
                  <Search className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Search Within Document</span>
                </button>
                <a
                  href={doc.storageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-15 py-2 rounded-md bg-surface text-on-surface border border-outline hover:bg-surface-subtle font-t05 text-t05 transition-colors duration-instant ease-instant"
                >
                  <span>Open File</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
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
