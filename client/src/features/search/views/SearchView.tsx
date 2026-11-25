import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Link as LinkIcon } from 'lucide-react';
import type { DocumentFormat, SearchMode } from '@documind/shared';
import { cn } from '../../../core/lib/utils';
import { fetchDocuments } from '../../documents/api/documents.api';
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
    label: 'Hybrid Search (RRF)',
    description: 'Combining keyword BM25 + vector similarity via Reciprocal Rank Fusion.',
  },
  {
    id: 'semantic',
    label: 'Semantic Match',
    description: 'Finding conceptual meaning even when exact words differ.',
  },
  {
    id: 'keyword',
    label: 'Exact Clause',
    description: 'Strict full-text matching for exact contract codes, clause numbers, and names.',
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
  const [copiedLink, setCopiedLink] = useState(false);
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
    queryKey: ['search-browse-docs', format ?? 'all'],
    queryFn: () =>
      fetchDocuments({
        status: 'completed',
        limit: 50,
        ...(format ? { fileType: format } : {}),
      }),
    enabled: !hasQuery && effectiveSelectedFormats.length > 0,
    staleTime: 30_000,
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
  const activeModeMeta = MODE_OPTIONS.find((m) => m.id === mode) ?? MODE_OPTIONS[0];

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

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1500);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  };

  const handleSubmit = () => {
    const currentQuery = useSearchStore.getState().query.trim();
    if (debouncedQuery.trim() === currentQuery && currentQuery.length > 0) {
      void searchQuery.refetch();
    }
  };

  return (
    <>
      <section className="flex flex-col gap-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-15">
          <div className="flex flex-col gap-1">
            <h1 className="font-t00 text-t00 text-on-surface tracking-tight text-balance">
              Clause &amp; Document Search Engine
            </h1>
            <p className="font-t04 text-t04 text-on-surface-variant text-pretty">
              Sub-second hybrid search across verified clauses, tables, and slides without opening files.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleCopyShareLink()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface text-on-surface border border-outline hover:bg-surface-subtle font-t05 text-t05 transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus self-start md:self-auto shrink-0"
          >
            {copiedLink ? (
              <Check className="w-3.5 h-3.5 text-status-ready-text" aria-hidden="true" />
            ) : (
              <LinkIcon className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>

        <SearchCommandBar onSubmitQuery={handleSubmit} />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-15">
          <div
            role="tablist"
            aria-label="Search Mode"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-soft bg-surface-subtle border border-outline self-start"
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
                    'px-15 py-2 rounded-soft font-t04 text-t04-medium transition-colors duration-standard ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus',
                    isSelected
                      ? 'bg-surface text-on-surface shadow-sm'
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

      <section className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-20 items-start">
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
              hasActiveFilters={hasActiveFilters}
              onScopeDocument={setDocumentId}
              onResetFilters={handleResetAllFilters}
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
