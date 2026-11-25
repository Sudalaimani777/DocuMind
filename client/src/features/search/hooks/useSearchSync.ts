import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DocumentFormat, SearchMode } from '@documind/shared';
import { useSearchStore } from '../store/searchStore';

const VALID_MODES = new Set<SearchMode>(['hybrid', 'semantic', 'keyword']);
const VALID_FORMATS = new Set<DocumentFormat>(['pdf', 'docx', 'xlsx', 'pptx']);
const SEARCH_DEBOUNCE_MS = 300;

function parseMode(value: string | null): SearchMode {
  if (value && VALID_MODES.has(value as SearchMode)) {
    return value as SearchMode;
  }
  return 'hybrid';
}

function parseFormat(value: string | null): DocumentFormat | undefined {
  if (value && VALID_FORMATS.has(value as DocumentFormat)) {
    return value as DocumentFormat;
  }
  return undefined;
}

/**
 * Synchronizes URL search parameters (?q=&mode=&format=&startDate=&endDate=&documentId=)
 * with useSearchStore using a 300ms input debounce.
 */
export function useSearchSync(): { debouncedQuery: string } {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useSearchStore((s) => s.query);
  const mode = useSearchStore((s) => s.mode);
  const format = useSearchStore((s) => s.format);
  const startDate = useSearchStore((s) => s.startDate);
  const endDate = useSearchStore((s) => s.endDate);
  const documentId = useSearchStore((s) => s.documentId);
  const hydrateFromParams = useSearchStore((s) => s.hydrateFromParams);

  const [debouncedQuery, setDebouncedQuery] = useState<string>(
    () => searchParams.get('q') ?? ''
  );

  const lastWrittenSearchRef = useRef<string | null>(null);
  const currentSearchString = searchParams.toString();

  // Hydrate store only when URL search params change externally (not from our own write)
  useEffect(() => {
    if (lastWrittenSearchRef.current === currentSearchString) {
      lastWrittenSearchRef.current = null;
      return;
    }

    const urlQ = searchParams.get('q') ?? '';
    const urlMode = parseMode(searchParams.get('mode'));
    const urlFormat = parseFormat(searchParams.get('format'));
    const urlStart = searchParams.get('startDate') ?? '';
    const urlEnd = searchParams.get('endDate') ?? '';
    const urlDocId = searchParams.get('documentId') ?? undefined;

    hydrateFromParams({
      query: urlQ,
      mode: urlMode,
      format: urlFormat,
      startDate: urlStart,
      endDate: urlEnd,
      documentId: urlDocId,
    });
    setDebouncedQuery(urlQ);
  }, [currentSearchString, searchParams, hydrateFromParams]);

  // Debounce query input by 300ms before updating debouncedQuery and URL
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Push debounced state to URL params without polluting browser history
  useEffect(() => {
    const next = new URLSearchParams();
    const trimmed = debouncedQuery.trim();
    if (trimmed) next.set('q', trimmed);
    if (mode !== 'hybrid') next.set('mode', mode);
    if (format) next.set('format', format);
    if (startDate) next.set('startDate', startDate);
    if (endDate) next.set('endDate', endDate);
    if (documentId) next.set('documentId', documentId);

    const nextString = next.toString();
    if (nextString !== currentSearchString) {
      lastWrittenSearchRef.current = nextString;
      setSearchParams(next, { replace: true });
    }
  }, [
    debouncedQuery,
    mode,
    format,
    startDate,
    endDate,
    documentId,
    currentSearchString,
    setSearchParams,
  ]);

  return { debouncedQuery };
}
