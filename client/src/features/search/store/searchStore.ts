import { create } from 'zustand';
import type { DocumentFormat, SearchMode, SearchResultItemDTO } from '@documind/shared';

interface SearchState {
  query: string;
  mode: SearchMode;
  format: DocumentFormat | undefined;
  startDate: string;
  endDate: string;
  documentId: string | undefined;
  selectedResult: SearchResultItemDTO | null;
  isCommandPaletteOpen: boolean;
  setQuery: (query: string) => void;
  setMode: (mode: SearchMode) => void;
  setFormat: (format: DocumentFormat | undefined) => void;
  setDateRange: (startDate: string, endDate: string) => void;
  setDocumentId: (documentId: string | undefined) => void;
  setSelectedResult: (result: SearchResultItemDTO | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  hydrateFromParams: (params: {
    query: string;
    mode: SearchMode;
    format?: DocumentFormat;
    startDate: string;
    endDate: string;
    documentId?: string;
  }) => void;
  resetFilters: () => void;
}

/**
 * Zustand store managing client-side search workbench and Command Palette state.
 */
export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  mode: 'hybrid',
  format: undefined,
  startDate: '',
  endDate: '',
  documentId: undefined,
  selectedResult: null,
  isCommandPaletteOpen: false,

  setQuery: (query) => set({ query }),
  setMode: (mode) => set({ mode }),
  setFormat: (format) => set({ format }),
  setDateRange: (startDate, endDate) => set({ startDate, endDate }),
  setDocumentId: (documentId) => set({ documentId }),
  setSelectedResult: (selectedResult) => set({ selectedResult }),
  setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
  toggleCommandPalette: () =>
    set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),

  hydrateFromParams: (params) =>
    set({
      query: params.query,
      mode: params.mode,
      format: params.format,
      startDate: params.startDate,
      endDate: params.endDate,
      documentId: params.documentId,
    }),

  resetFilters: () =>
    set({
      format: undefined,
      startDate: '',
      endDate: '',
      documentId: undefined,
    }),
}));
