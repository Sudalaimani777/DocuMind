# Frontend Client Routing & Navigation — DocuMind

> **Package**: `client/src/app/`  
> **Router**: React Router v6+ (Data Router / `createBrowserRouter`)

---

## 1. Route Map & View Registry

DocuMind uses a clean nested route hierarchy wrapped inside a persistent `AppShell` layout:

```
/
├── /documents              # Document Library & Upload Dropzone
├── /search                 # Intelligent Multi-Mode Search (supports ?q=&mode=)
├── /chat                   # Multi-Document Corpus AI Assistant
├── /chat/:documentId       # Single-Document Scoped Assistant
└── /settings               # AI Provider Configuration & Health
```

| Route Path | View Component | Query Parameters Supported | Description |
| :--- | :--- | :--- | :--- |
| `/` | `Navigate` | None | Automatically redirects to `/documents`. |
| `/documents` | `DocumentsView` | `?page=1&sort=date` | Document library catalog with drag-and-drop dropzone. |
| `/search` | `SearchView` | `?q=<string>&mode=hybrid\|keyword\|semantic&format=pdf` | Multi-mode search interface with deep-linked search params. |
| `/chat` | `ChatView` | None | General cross-document AI conversation interface. |
| `/chat/:documentId`| `ChatView` | None | Scoped conversation restricted to a single target document. |
| `/settings` | `SettingsView` | None | AI provider configuration and connection test panel. |
| `*` | `NotFoundView` | None | Accessible 404 page with return link to `/documents`. |

---

## 2. Route Definition (`src/app/routes.tsx`)

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { DocumentsView } from '../features/documents/views/DocumentsView';
import { SearchView } from '../features/search/views/SearchView';
import { ChatView } from '../features/chat/views/ChatView';
import { SettingsView } from '../features/settings/views/SettingsView';
import { NotFoundView } from '../components/layout/NotFoundView';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/documents" replace /> },
      { path: 'documents', element: <DocumentsView /> },
      { path: 'search', element: <SearchView /> },
      { path: 'chat', element: <ChatView /> },
      { path: 'chat/:documentId', element: <ChatView /> },
      { path: 'settings', element: <SettingsView /> },
      { path: '*', element: <NotFoundView /> },
    ],
  },
]);
```

---

## 3. URL State Synchronization (Deep Linking)

In the search interface, query inputs and active filters are synchronized with the browser URL:
* When a user searches for `"EBITDA margins"` in `hybrid` mode, the URL updates to:  
  `/search?q=EBITDA+margins&mode=hybrid`
* **Benefit**: Allows users to bookmark, refresh, and share exact search results without losing context or filter selections.
* **Implementation Hook**: Uses `useSearchParams` from `react-router-dom` with a 300ms debounce to prevent URL history pollution.
