import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Protects private workspace routes by verifying the HTTP-only cookie session
 * and redirecting unauthenticated visitors to /signin.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isCheckingAuth = useAuthStore((s) => s.isCheckingAuth);
  const hasCheckedAuth = useAuthStore((s) => s.hasCheckedAuth);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    if (!hasCheckedAuth) {
      void checkAuth();
    }
  }, [hasCheckedAuth, checkAuth]);

  if (!hasCheckedAuth || isCheckingAuth) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-surface text-on-surface"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 font-t04 text-t04 text-on-surface-variant">
          <Loader2 className="w-5 h-5 animate-spin text-secondary" aria-hidden="true" />
          <span>Verifying workspace session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
