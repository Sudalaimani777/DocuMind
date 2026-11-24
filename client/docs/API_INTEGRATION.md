# API Integration & Network Layer — DocuMind Client

> **Package**: `client/src/services/`  
> **HTTP Client**: Axios v1.7+  
> **Streaming Protocol**: Server-Sent Events (SSE)

---

## 1. Centralized Axios API Client (`src/services/api-client.ts`)

DocuMind uses a configured Axios instance with automated error interceptors and toast alerts:

```typescript
import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30s timeout
});

// Response Error Interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { message?: string; code?: string } }>) => {
    const status = error.response?.status;
    const serverMessage = error.response?.data?.error?.message;

    if (status === 409) {
      toast.warning('Duplicate Document', {
        description: serverMessage || 'This exact file has already been ingested.',
      });
    } else if (status === 429) {
      toast.error('Rate Limit Exceeded', {
        description: 'Too many requests. Please wait a moment before trying again.',
      });
    } else if (status && status >= 500) {
      toast.error('Server Error', {
        description: serverMessage || 'An unexpected error occurred. Please try again.',
      });
    }

    return Promise.reject(error);
  }
);
```

---

## 2. Feature API Modules

### 2.1 Document Ingestion API (`src/features/documents/api/documents.api.ts`)
```typescript
import { apiClient } from '../../../services/api-client';

export async function uploadDocuments(
  files: File[],
  onProgress?: (percent: number) => void
) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await apiClient.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress?.(percent);
      }
    },
  });

  return response.data;
}

export async function deleteDocument(id: string) {
  const response = await apiClient.delete(`/documents/${id}`);
  return response.data;
}
```

### 2.2 Search API (`src/features/search/api/search.api.ts`)
```typescript
import { apiClient } from '../../../services/api-client';

export interface SearchParams {
  q: string;
  mode: 'hybrid' | 'keyword' | 'semantic';
  format?: string;
  limit?: number;
}

export async function executeSearch(params: SearchParams) {
  const response = await apiClient.get('/search', { params });
  return response.data.data;
}
```

---

## 3. Server-Sent Events (SSE) Client

For real-time job progress tracking:

```typescript
export function subscribeToJobProgress(
  jobId: string,
  callbacks: {
    onProgress: (data: { stage: string; progress: number }) => void;
    onCompleted: () => void;
    onError: (error: string) => void;
  }
): () => void {
  const sseUrl = `${import.meta.env.VITE_API_URL}/jobs/${jobId}/progress`;
  const eventSource = new EventSource(sseUrl);

  eventSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data);
    callbacks.onProgress(data);
    if (data.stage === 'COMPLETED') {
      callbacks.onCompleted();
      eventSource.close();
    }
  });

  eventSource.addEventListener('error', () => {
    callbacks.onError('Lost real-time connection to ingestion job.');
    eventSource.close();
  });

  // Return cleanup unsubscribe function
  return () => {
    eventSource.close();
  };
}
```

---

## 4. Grounded RAG Streaming Reader (`src/features/chat/api/rag.api.ts`)

Consumes streaming tokens and citation badges from `POST /api/chat/rag`:

```typescript
export async function streamRagChat(
  payload: { query: string; documentId?: string; history: any[] },
  onToken: (token: string) => void,
  onCitation: (citation: any) => void
) {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/chat/rag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.body) throw new Error('ReadableStream not supported.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunkStr = decoder.decode(value);
    const lines = chunkStr.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const json = JSON.parse(line.replace('data: ', ''));
        if (json.text) onToken(json.text);
        if (json.badge) onCitation(json);
      }
    }
  }
}
```
