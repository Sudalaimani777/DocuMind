# Frontend Client Routing & Navigation — DocuMind

> **Package**: `client/src/app/`  
> **Router**: React Router v6+ (Data Router / `createBrowserRouter`)

---

## 1. Route Map & View Registry

DocuMind uses a clean nested route hierarchy separating public authentication from protected application views wrapped inside `<AuthGuard>` and persistent `<AppShell>` layouts:

```
Public Routes:
├── /signin                 # Enterprise Login Screen
└── /signup                 # User Registration Screen (Name, Organization, Email, Password)

Protected Routes (Requires Auth):
├── /                       # Dashboard: KPIs, Storage Distribution, Live Ingestion Queue
├── /library                # Document Library: Table, Format Filters, Upload Dropzone
├── /search                 # Search Repository: Hybrid RRF, Semantic, Keyword Modes
├── /chat                   # Grounded AI Chat Assistant (Multi-document corpus)
├── /chat/:documentId       # Grounded AI Chat Assistant (Single-document deep dive)
├── /history                # Chat History: Past RAG sessions, question logs, resumption
└── /settings               # Settings & Observability: AI Provider Switcher (Ollama / Gemini)
```

| Route Path | View Component | Access Level | Description |
| :--- | :--- | :---: | :--- |
| `/signin` | `SignInView` | Public | Enterprise login with email and password. |
| `/signup` | `SignUpView` | Public | Account registration (Name, Organization, Email, Password). |
| `/` | `DashboardView` | Protected | Command center with operational health, formats, and BullMQ queue streams. |
| `/library` | `LibraryView` | Protected | User-scoped document data table, format pills, and upload dropzone. |
| `/search` | `SearchView` | Protected | Multi-mode search workbench with deep-linked URL parameters (`?q=&mode=`). |
| `/chat` | `ChatView` | Protected | Grounded RAG conversational interface with interactive citation badges. |
| `/chat/:documentId` | `ChatView` | Protected | Scoped conversational assistant restricted to a single target document. |
| `/history` | `HistoryView` | Protected | Saved chat session list, Q&A transcripts, and conversation deletion. |
| `/settings` | `SettingsView` | Protected | AI provider configuration (Ollama vs. Gemini) and service latency test. |
| `*` | `NotFoundView` | Public | Accessible 404 page with return link to dashboard. |

---

## 2. Route Definition (`src/app/routes.tsx`)

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthGuard } from '../core/auth/AuthGuard';
import { AppShell } from '../components/layout/AppShell';
import { SignInView } from '../features/auth/views/SignInView';
import { SignUpView } from '../features/auth/views/SignUpView';
import { DashboardView } from '../features/dashboard/views/DashboardView';
import { LibraryView } from '../features/documents/views/LibraryView';
import { SearchView } from '../features/search/views/SearchView';
import { ChatView } from '../features/chat/views/ChatView';
import { HistoryView } from '../features/chat-history/views/HistoryView';
import { SettingsView } from '../features/settings/views/SettingsView';
import { NotFoundView } from '../components/layout/NotFoundView';

export const router = createBrowserRouter([
  // Public Auth Routes
  { path: '/signin', element: <SignInView /> },
  { path: '/signup', element: <SignUpView /> },

  // Protected Enterprise Workspace Routes
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <DashboardView /> },
      { path: 'library', element: <LibraryView /> },
      { path: 'documents', element: <Navigate to="/library" replace /> },
      { path: 'search', element: <SearchView /> },
      { path: 'chat', element: <ChatView /> },
      { path: 'chat/:documentId', element: <ChatView /> },
      { path: 'history', element: <HistoryView /> },
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
