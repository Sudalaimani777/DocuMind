import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import type { DocumentFormat, SearchMode } from '@documind/shared';
import { cn } from '../../../core/lib/utils';
import { fetchDocuments } from '../../documents/api/documents.api';
import { documentQueryKeys } from '../../documents/hooks/useDocuments';
import { BrowseDocumentsFeed } from '../components/BrowseDocumentsFeed';
import { SearchCommandBar } from '../components/SearchCommandBar';
import { SearchFiltersSidebar, type DatePreset } from '../components/SearchFiltersSidebar';
import { getMatchConfidencePercent } from '../components/SearchResultCard';
import { SearchResultsFeed } from '../components/SearchResultsFeed';
import { SourceChunkDrawer } from '../components/SourceChunkDrawer';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { useSearchSync } from '../hooks/useSearchSync';
import { useSearchStore } from '../store/searchStore';

const MODE_OPTIONS: Array<{ id: SearchMode; label: string; description: string }> = [
  {
    id: 'hybrid',
    label: 'Smart Search',
    description: 'Combines keyword matching and meaning for the best results.',
  },
  {
    id: 'semantic',
    label: 'By Meaning',
    description: 'Finds related concepts even when exact words differ.',
  },
  {
    id: 'keyword',
    label: 'Exact Text',
    description: 'Matches exact clause numbers, codes, and phrases.',
  },
];

function datePresetToStartIso(preset: DatePreset): string {
  if (preset === 'all') return '';
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Clause & Document Search Engine (/search).
 */
export function SearchView() {
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [selectedFormats, setSelectedFormats] = useState<DocumentFormat[]>([
    'pdf',
    'docx',
    'xlsx',
    'pptx',
  ]);

  const mode = useSearchStore((s) => s.mode);
  const format = useSearchStore((s) => s.format);
  const startDate = useSearchStore((s) => s.startDate);
  const endDate = useSearchStore((s) => s.endDate);
  const documentId = useSearchStore((s) => s.documentId);
  const selectedResult = useSearchStore((s) => s.selectedResult);

  const setMode = useSearchStore((s) => s.setMode);
  const setFormat = useSearchStore((s) => s.setFormat);
  const setDateRange = useSearchStore((s) => s.setDateRange);
  const setDocumentId = useSearchStore((s) => s.setDocumentId);
  const setSelectedResult = useSearchStore((s) => s.setSelectedResult);
  const resetStoreFilters = useSearchStore((s) => s.resetFilters);

  const { debouncedQuery } = useSearchSync();
  const hasQuery = debouncedQuery.trim().length > 0;

  const effectiveSelectedFormats = useMemo<DocumentFormat[]>(() => {
    return format ? [format] : selectedFormats;
  }, [format, selectedFormats]);

  const searchQuery = useSearchQuery({
    q: debouncedQuery,
    mode,
    format,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    documentId,
    limit: 20,
  });

  const browseDocsQuery = useQuery({
    queryKey: documentQueryKeys.list({
      status: 'completed',
      limit: 50,
      ...(format ? { fileType: format } : {}),
    }),
    queryFn: () =>
      fetchDocuments({
        status: 'completed',
        limit: 50,
        ...(format ? { fileType: format } : {}),
      }),
    enabled: !hasQuery && effectiveSelectedFormats.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const filteredBrowseDocs = useMemo(() => {
    const items = browseDocsQuery.data?.items ?? [];
    const startMs = startDate ? new Date(startDate).getTime() : null;
    return items.filter((doc) => {
      if (
        effectiveSelectedFormats.length < 4 &&
        !effectiveSelectedFormats.includes(doc.fileType as DocumentFormat)
      ) {
        return false;
      }
      if (startMs && new Date(doc.createdAt).getTime() < startMs) return false;
      if (documentId && doc.id !== documentId) return false;
      return true;
    });
  }, [browseDocsQuery.data?.items, effectiveSelectedFormats, startDate, documentId]);

  const filteredResults = useMemo(() => {
    if (effectiveSelectedFormats.length === 0) return [];
    const raw = searchQuery.data?.results ?? [];
    return raw.filter((item) => {
      if (effectiveSelectedFormats.length < 4 && !effectiveSelectedFormats.includes(item.fileType)) {
        return false;
      }
      if (minConfidence > 0 && getMatchConfidencePercent(item) < minConfidence) return false;
      return true;
    });
  }, [searchQuery.data?.results, effectiveSelectedFormats, minConfidence]);

  const hasActiveFilters = Boolean(
    format || startDate || endDate || documentId || minConfidence > 0 || effectiveSelectedFormats.length < 4
  );

  const handleFormatToggle = (target: DocumentFormat) => {
    const next = effectiveSelectedFormats.includes(target)
      ? effectiveSelectedFormats.filter((f) => f !== target)
      : [...effectiveSelectedFormats, target];
    setSelectedFormats(next);
    setFormat(next.length === 1 ? next[0] : undefined);
  };

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setDateRange(datePresetToStartIso(preset), '');
  };

  const handleResetAllFilters = () => {
    setSelectedFormats(['pdf', 'docx', 'xlsx', 'pptx']);
    setDatePreset('all');
    setMinConfidence(0);
    resetStoreFilters();
  };

  const handleSubmit = () => {
    const currentQuery = useSearchStore.getState().query.trim();
    if (debouncedQuery.trim() === currentQuery && currentQuery.length > 0) {
      void searchQuery.refetch();
    }
  };

  return (
    <>
      <section className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-t01 text-t01 text-on-surface tracking-tight text-balance">
              Search Documents
            </h1>
            <p className="font-t04 text-t04 text-on-surface-variant text-pretty">
              Find clauses, tables, and slides across your uploaded files.
            </p>
          </div>
        </div>

        <SearchCommandBar onSubmitQuery={handleSubmit} />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Search Mode"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-md bg-surface-subtle border border-outline self-start"
          >
            {MODE_OPTIONS.map((opt) => {
              const isSelected = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setMode(opt.id)}
                  className={cn(
                    'px-3 py-1 rounded-md font-t05 text-t05 transition-colors duration-standard ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus',
                    isSelected
                      ? 'bg-surface text-on-surface shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5 items-start">
        <SearchFiltersSidebar
          selectedFormats={effectiveSelectedFormats}
          datePreset={datePreset}
          minConfidence={minConfidence}
          documentId={documentId}
          onToggleFormat={handleFormatToggle}
          onDatePresetChange={handleDatePresetChange}
          onMinConfidenceChange={setMinConfidence}
          onClearDocumentScope={() => setDocumentId(undefined)}
          onResetAll={handleResetAllFilters}
        />

        <div className="flex flex-col gap-15 min-w-0">
          {searchQuery.data?.degraded ? (
            <div
              role="status"
              className="flex items-center gap-2 px-15 py-2.5 rounded-md bg-status-queued-bg border border-status-queued-border text-status-queued-text font-t04 text-t04"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                Semantic AI provider is currently unavailable — showing Keyword (FTS) results.
              </span>
            </div>
          ) : null}

          {effectiveSelectedFormats.length === 0 ? (
            <div className="bg-surface border border-outline rounded-card p-32 flex flex-col items-center text-center gap-15">
              <div className="flex flex-col gap-1 max-w-md">
                <h2 className="font-t02 text-t02 text-on-surface">
                  Select at least one file format
                </h2>
                <p className="font-t04 text-t04 text-on-surface-variant">
                  Enable PDF, Word, Excel, or PowerPoint in the Filters panel to view matching clauses.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="px-15 py-2 rounded-md border border-outline bg-surface text-on-surface hover:bg-surface-subtle font-t04 text-t04-medium"
              >
                Reset all filters
              </button>
            </div>
          ) : !hasQuery ? (
            <BrowseDocumentsFeed
              documents={filteredBrowseDocs}
              isLoading={browseDocsQuery.isLoading}
              isError={browseDocsQuery.isError}
              hasActiveFilters={hasActiveFilters}
              onScopeDocument={setDocumentId}
              onResetFilters={handleResetAllFilters}
              onRetry={() => void browseDocsQuery.refetch()}
            />
          ) : (
            <SearchResultsFeed
              data={searchQuery.data}
              results={filteredResults}
              isLoading={searchQuery.isLoading}
              isFetching={searchQuery.isFetching}
              isError={searchQuery.isError}
              error={searchQuery.error}
              hasActiveFilters={hasActiveFilters}
              onRetry={() => void searchQuery.refetch()}
              onResetFilters={handleResetAllFilters}
              onInspectResult={setSelectedResult}
            />
          )}
        </div>
      </section>

      <SourceChunkDrawer result={selectedResult} onClose={() => setSelectedResult(null)} />
    </>
  );
}

export default SearchView;
