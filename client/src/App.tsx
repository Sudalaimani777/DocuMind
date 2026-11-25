import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './app/providers';
import { router } from './app/routes';
import { ErrorBoundary } from './components/layout/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </ErrorBoundary>
  );
}
