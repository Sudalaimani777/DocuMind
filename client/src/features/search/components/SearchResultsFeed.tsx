import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { SearchResponseDTO, SearchResultItemDTO } from '@documind/shared';
import { SearchResultCard } from './SearchResultCard';

interface SearchResultsFeedProps {
  data: SearchResponseDTO | undefined;
  results: SearchResultItemDTO[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  hasActiveFilters: boolean;
  onRetry: () => void;
  onResetFilters: () => void;
  onInspectResult: (result: SearchResultItemDTO) => void;
}

/**
 * Renders chunk search results along with loading, error, degraded-mode, and empty states.
 */
export function SearchResultsFeed({
  data,
  results,
  isLoading,
  isFetching,
  isError,
  error,
  hasActiveFilters,
  onRetry,
  onResetFilters,
  onInspectResult,
}: SearchResultsFeedProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-15" aria-busy="true" aria-label="Loading search results">
        {[0, 1, 2].map((idx) => (
          <div
            key={idx}
            className="bg-surface border border-outline rounded-card p-20 flex flex-col gap-15 animate-pulse"
          >
            <div className="h-5 w-1/3 bg-surface-subtle rounded-md" />
            <div className="h-3 w-1/4 bg-surface-subtle rounded-md" />
            <div className="h-12 w-full bg-surface-subtle rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="bg-status-failed-bg border border-status-failed-border rounded-card p-20 flex flex-col sm:flex-row sm:items-center justify-between gap-15"
      >
        <div className="flex items-start gap-2.5 text-status-failed-text">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <span className="font-t03 text-t03">Search request failed</span>
            <span className="font-t04 text-t04">
              {error instanceof Error ? error.message : 'Unable to complete search query.'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-15 py-2 rounded-md bg-surface border border-outline text-on-surface hover:bg-surface-subtle font-t05 text-t05 shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (results.length === 0) {
    return (
      <div className="bg-surface border border-outline rounded-card p-32 flex flex-col items-center text-center gap-15">
        <div className="flex flex-col gap-1 max-w-md">
          <h2 className="font-t02 text-t02 text-on-surface">No matching clauses found</h2>
          <p className="font-t04 text-t04 text-on-surface-variant">
            No completed documents matched &ldquo;{data.query}&rdquo;
            {hasActiveFilters ? ' with the active filters.' : '.'}
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
          {results.length} verified {results.length === 1 ? 'match' : 'matches'} in {data.tookMs} ms
        </span>
        {isFetching ? (
          <span className="font-t05 text-t05 text-on-surface-variant">Updating...</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-15">
        {results.map((result) => (
          <SearchResultCard key={result.chunkId} result={result} onInspect={onInspectResult} />
        ))}
      </div>
    </>
  );
}
