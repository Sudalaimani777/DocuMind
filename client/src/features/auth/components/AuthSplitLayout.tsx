import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../../core/store/authStore';
import { AuthHeroPanel } from './AuthHeroPanel';
import { BrandMark } from './BrandMark';

interface AuthSplitLayoutProps {
  title: string;
  subtitle: string;
  footerText: string;
  footerLinkLabel: string;
  footerLinkTo: string;
  children: ReactNode;
}

/**
 * Shared editorial split-screen layout for authentication views (/signin, /signup).
 */
export function AuthSplitLayout({
  title,
  subtitle,
  footerText,
  footerLinkLabel,
  footerLinkTo,
  children,
}: AuthSplitLayoutProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/library" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface">
      <main className="flex-1 flex items-center justify-center px-20 lg:px-32 py-32">
        <div className="w-full max-w-md flex flex-col gap-20">
          <BrandMark />

          <header className="flex flex-col gap-2">
            <h1 className="font-t00 text-t00 text-on-surface tracking-tight">
              {title}
            </h1>
            <p className="font-t04 text-t04 text-on-surface-variant text-pretty">
              {subtitle}
            </p>
          </header>

          {children}

          <p className="text-center font-t04 text-t04 text-on-surface-variant pt-1">
            {footerText}
            <Link
              to={footerLinkTo}
              className="font-t04-medium text-secondary hover:underline ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus rounded-xs"
            >
              {footerLinkLabel}
            </Link>
          </p>
        </div>
      </main>

      <AuthHeroPanel />
    </div>
  );
}
