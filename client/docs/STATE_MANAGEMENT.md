# State Management & Caching Architecture — DocuMind Client

> **Package**: `client/src/stores/` & `client/src/features/*/hooks/`  
> **Server State**: TanStack Query v5  
> **Client UI State**: Zustand v5

---

## 1. State Segregation Matrix

| State Category | Technology | Stored Data | Lifetime |
| :--- | :--- | :--- | :--- |
| **Server State** | **TanStack Query** | Document lists, search results, job statuses, active AI provider | Cached in memory, auto-revalidated on SSE triggers or mutations |
| **Client UI State** | **Zustand** | Active upload queue progress, citation drawer preview selection, drawer toggle states | Session lifetime in client memory |
| **URL State** | **React Router** | Active search query `?q=`, mode `?mode=`, pagination `?page=` | Synced with browser history and address bar |
| **Local Form State** | **`useState`** | Active text input values, dropdown open/close | Component lifecycle only |

---

## 2. TanStack Query Configuration & Key Factory

### 2.1 Query Client Setup (`src/app/providers.tsx`)
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3, // Data stays fresh for 3 minutes
      gcTime: 1000 * 60 * 15,    // Unused cache garbage collected after 15 minutes
      refetchOnWindowFocus: false, // Prevents unnecessary refetches
      retry: 1,
    },
  },
});
```

### 2.2 Hierarchical Query Keys (`src/services/query-keys.ts`)
```typescript
export const queryKeys = {
  documents: {
    all: ['documents'] as const,
    list: (filters: { page?: number; limit?: number; fileType?: string }) =>
      [...queryKeys.documents.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.documents.all, 'detail', id] as const,
  },
  search: {
    query: (params: { q: string; mode: string; format?: string }) =>
      ['search', params] as const,
  },
  jobs: {
    all: ['jobs'] as const,
  },
  provider: {
    current: ['provider'] as const,
  },
};
```

### 2.3 Cache Invalidation upon Real-Time SSE Events
When the SSE stream reports that a document job transitioned to `COMPLETED`:
```typescript
// Inside useSSEProgress hook:
if (event.stage === 'COMPLETED') {
  // Invalidate documents list to refresh table automatically
  queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
}
```

---

## 3. Zustand Global Stores

### 3.1 Upload Store (`src/stores/useUploadStore.ts`)
Manages active file upload progress bars and upload drawer visibility:
```typescript
import { create } from 'zustand';

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
}

interface UploadState {
  queue: UploadItem[];
  isDrawerOpen: boolean;
  addFiles: (files: File[]) => void;
  updateProgress: (id: string, progress: number) => void;
  setStatus: (id: string, status: UploadItem['status'], error?: string) => void;
  toggleDrawer: (open?: boolean) => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  queue: [],
  isDrawerOpen: false,
  addFiles: (files) =>
    set((state) => ({
      queue: [
        ...state.queue,
        ...files.map((file) => ({
          id: `${file.name}-${Date.now()}`,
          file,
          progress: 0,
          status: 'queued' as const,
        })),
      ],
      isDrawerOpen: true,
    })),
  updateProgress: (id, progress) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id ? { ...item, progress } : item
      ),
    })),
  setStatus: (id, status, error) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id ? { ...item, status, error } : item
      ),
    })),
  toggleDrawer: (open) =>
    set((state) => ({
      isDrawerOpen: open ?? !state.isDrawerOpen,
    })),
}));
```

### 3.2 Chat & Citation Store (`src/stores/useChatStore.ts`)
Manages citation preview drawers and document conversation scope:
```typescript
import { create } from 'zustand';

export interface CitationPayload {
  documentTitle: string;
  coordinates: {
    pageNumber?: number;
    sheetName?: string;
    rowRange?: string;
    slideNumber?: number;
  };
  content: string;
}

interface ChatState {
  selectedCitation: CitationPayload | null;
  isCitationDrawerOpen: boolean;
  openCitation: (citation: CitationPayload) => void;
  closeCitation: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  selectedCitation: null,
  isCitationDrawerOpen: false,
  openCitation: (citation) =>
    set({ selectedCitation: citation, isCitationDrawerOpen: true }),
  closeCitation: () =>
    set({ selectedCitation: null, isCitationDrawerOpen: false }),
}));
```
