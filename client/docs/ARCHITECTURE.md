# Frontend Architecture & Component Hierarchy — DocuMind Client

> **Package**: `client/`  
> **Framework**: React 19 + TypeScript + Vite  
> **Pattern**: Feature-Sliced Architecture + Declarative State Segregation

---

## 1. Feature-Sliced Architecture Overview

The DocuMind frontend is organized by **domain features** rather than generic technical layers (such as flat "components/" or "pages/" folders):

```
client/src/
├── app/                     # Application bootstrap & providers
│   ├── App.tsx              # Root component with routing
│   ├── providers.tsx        # TanStack Query, Theme, Toast providers
│   └── routes.tsx           # Route definitions & layout wrappers
├── components/              # Shared cross-cutting components
│   ├── layout/              # Shell layout (Sidebar, Header, MainContainer)
│   └── ui/                  # shadcn/ui Radix primitives (Button, Dialog, Drawer)
├── features/                # Domain-specific feature modules
│   ├── upload/              # Drag-and-drop dropzone, multi-file queue
│   ├── documents/           # Document library table, delete modal, filters
│   ├── search/              # Search bar, mode selector, highlight cards
│   ├── chat/                # RAG chat assistant, citation badge, source drawer
│   ├── history/             # BullMQ job timeline drawer, retry trigger
│   └── settings/            # AI provider switcher & connection ping
├── hooks/                   # Shared custom React hooks (useDebounce, useSSE)
├── services/                # Network clients (Axios instance, SSE client)
├── stores/                  # Global Zustand UI stores
├── types/                   # Shared frontend TypeScript interfaces
└── main.tsx                 # Vite DOM mount point
```

---

## 2. Component Composition Hierarchy

```
┌────────────────────────────────────────────────────────┐
│                      APP LAYOUT                        │
├─────────────────┬──────────────────────────────────────┤
│ SIDEBAR         │ HEADER                               │
│ • Logo & Brand  │ • Active Route Title                 │
│ • Nav Links     │ • Global Search Trigger (Ctrl+K)     │
│   - Documents   │ • Active AI Provider Badge           │
│   - Search      │ • History Drawer Toggle Button       │
│   - Chat        ├──────────────────────────────────────┤
│   - Settings    │ MAIN VIEWPORT CONTAINER              │
│ • Storage Usage │ ┌──────────────────────────────────┐ │
│   Summary       │ │ ACTIVE ROUTE VIEW                │ │
│                 │ │ • Documents: Dropzone + Table    │ │
│                 │ │ • Search: FilterSidebar + Cards  │ │
│                 │ │ • Chat: ChatLog + CitationDrawer │ │
│                 │ └──────────────────────────────────┘ │
└─────────────────┴──────────────────────────────────────┘
```

---

## 3. State Management Segregation

```mermaid
flowchart TD
    subgraph ServerState["Server State (TanStack Query)"]
        D1["Document Catalog (['documents'])"]
        D2["Search Results (['search', query, mode])"]
        D3["Job Queue Status (['jobs'])"]
        D4["AI Provider Status (['provider'])"]
    end

    subgraph ClientState["Client UI State (Zustand)"]
        U1["Active Upload Queue & Progress Map"]
        U2["Active Chat Session & Reference Drawer State"]
        U3["Processing History Drawer Open/Close"]
        U4["Sidebar Collapse Toggle"]
    end

    subgraph LocalState["Local Component State (useState / useRef)"]
        L1["Search Input Form Text (debounced)"]
        L2["Modal Confirmation Open/Close"]
        L3["Table Column Sort Direction"]
    end
```

### State Segregation Rules
1. **Server State strictly belongs in TanStack Query**: Never copy document lists or search results into Zustand. TanStack Query manages caching, stale times (5 minutes default), and automatic background revalidation upon SSE job completion.
2. **Client State strictly belongs in Zustand**: Upload drawer toggle states, active citation preview selections, and local UI flags belong in lightweight Zustand stores.
3. **Form & Transient State strictly belongs in `useState`**: Input field values and dropdown hover states remain local to their components.

---

## 4. Real-Time Streaming & Sanitization Pipeline

```mermaid
sequenceDiagram
    participant SSE as Backend SSE Stream
    participant Hook as useSSE Hook
    participant Purify as DOMPurify Sanitizer
    participant DOM as React DOM Node

    SSE->>Hook: event: progress (75% - EMBEDDING)
    Hook->>Hook: Update Zustand upload progress store
    SSE->>Hook: event: token ("EBITDA margins reached...")
    Hook->>Hook: Append token to active message state
    SSE->>Hook: event: citation ("Page 14")
    Hook->>Purify: Pass raw text & coordinate markup
    Purify-->>DOM: Render sanitized HTML with safe citation pill
```
