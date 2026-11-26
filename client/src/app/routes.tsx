import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthGuard } from '../core/auth/AuthGuard';
import { AppShell } from '../components/layout/AppShell';
import { PhaseRoutePlaceholder } from '../components/layout/PhaseRoutePlaceholder';
import { SignInView } from '../features/auth/views/SignInView';
import { SignUpView } from '../features/auth/views/SignUpView';

const LibraryView = lazy(() => import('../features/documents/views/LibraryView'));
const SearchView = lazy(() => import('../features/search/views/SearchView'));
const ChatView = lazy(() => import('../features/chat/views/ChatView'));
const HistoryView = lazy(() => import('../features/chat-history/views/HistoryView'));

function RouteLoader() {
  return (
    <div className="py-48 flex items-center justify-center gap-2 font-t04 text-t04 text-on-surface-variant">
      <Loader2 className="w-5 h-5 animate-spin text-secondary" aria-hidden="true" />
      <span>Loading workspace...</span>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/signin',
    element: <SignInView />,
  },
  {
    path: '/signup',
    element: <SignUpView />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: (
          <PhaseRoutePlaceholder
            title="Executive Dashboard"
            phaseLabel="Phase 4"
            description="KPIs, storage distribution, and system observability arrive in Phase 4."
          />
        ),
      },
      {
        path: 'library',
        element: (
          <Suspense fallback={<RouteLoader />}>
            <LibraryView />
          </Suspense>
        ),
      },
      {
        path: 'documents',
        element: <Navigate to="/library" replace />,
      },
      {
        path: 'search',
        element: (
          <Suspense fallback={<RouteLoader />}>
            <SearchView />
          </Suspense>
        ),
      },
      {
        path: 'chat',
        element: (
          <Suspense fallback={<RouteLoader />}>
            <ChatView />
          </Suspense>
        ),
      },
      {
        path: 'chat/:documentId',
        element: (
          <Suspense fallback={<RouteLoader />}>
            <ChatView />
          </Suspense>
        ),
      },
      {
        path: 'history',
        element: (
          <Suspense fallback={<RouteLoader />}>
            <HistoryView />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <PhaseRoutePlaceholder
            title="Workspace Settings & Engine Administration"
            phaseLabel="Phase 4"
            description="Live AI provider switching and connection diagnostics arrive in Phase 4."
          />
        ),
      },
      {
        path: '*',
        element: <Navigate to="/library" replace />,
      },
    ],
  },
]);
