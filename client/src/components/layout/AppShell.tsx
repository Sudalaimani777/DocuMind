import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  History,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '../../core/lib/utils';
import { useAuthStore } from '../../core/store/authStore';
import { useSearchStore } from '../../features/search/store/searchStore';
import { CommandPalette } from './CommandPalette';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/library', label: 'Document Library', icon: FolderOpen },
  { to: '/search', label: 'Search Repository', icon: Search },
  { to: '/chat', label: 'AI Chat', icon: MessageSquareText },
  { to: '/history', label: 'Chat History', icon: History },
];

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/library': 'Document Library',
  '/search': 'Search Repository',
  '/chat': 'AI Chat',
  '/history': 'Chat History',
  '/settings': 'Workspace Settings',
};

function getInitials(name?: string): string {
  if (!name) return 'DM';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

/**
 * Persistent authenticated workspace shell with left navigation rail and sticky top bar.
 */
export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setCommandPaletteOpen = useSearchStore((s) => s.setCommandPaletteOpen);

  const currentTitle =
    ROUTE_TITLES[location.pathname] ??
    (location.pathname.startsWith('/chat/') ? 'AI Chat' : 'Workspace');

  const handleSignOut = async () => {
    await logout();
    navigate('/signin', { replace: true });
  };

  const renderNavLinks = (onNavigate?: () => void) => (
    <ul className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-15 px-15 py-2.5 rounded-md font-t04 text-t04-medium transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus',
                  isActive
                    ? 'bg-surface-accent-subtle text-secondary'
                    : 'text-on-surface hover:bg-surface-subtle'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Desktop Left Navigation Rail */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 min-h-screen border-r border-outline bg-surface justify-between p-20">
        <div className="flex flex-col gap-32">
          <Link
            to="/library"
            className="flex items-center gap-15 px-15 py-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
          >
            <span className="w-8 h-8 rounded-md bg-secondary text-on-secondary flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="font-t03 text-t03 text-on-surface leading-none">DocuMind</span>
              <span className="font-t05 text-t05 text-on-surface-variant">Enterprise RAG</span>
            </span>
          </Link>

          <nav aria-label="Main menu">{renderNavLinks()}</nav>
        </div>

        <div className="flex flex-col gap-2 pt-20 border-t border-outline">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-15 px-15 py-2.5 rounded-md font-t04 text-t04-medium transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus',
                isActive
                  ? 'bg-surface-accent-subtle text-secondary'
                  : 'text-on-surface hover:bg-surface-subtle'
              )
            }
          >
            <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Settings</span>
          </NavLink>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex items-center gap-15 px-15 py-2.5 rounded-md text-on-surface-variant hover:text-status-failed-text hover:bg-status-failed-bg font-t04 text-t04-medium transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus text-left"
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-pitch/25"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 bg-surface border-r border-outline p-20 flex flex-col justify-between min-h-screen">
            <div className="flex flex-col gap-20">
              <div className="flex items-center justify-between">
                <span className="font-t03 text-t03 text-on-surface">DocuMind</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1.5 rounded-md hover:bg-surface-subtle text-on-surface"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <nav aria-label="Mobile menu">
                {renderNavLinks(() => setMobileMenuOpen(false))}
              </nav>
            </div>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex items-center gap-15 px-15 py-2.5 rounded-md text-on-surface-variant hover:text-status-failed-text hover:bg-status-failed-bg font-t04 text-t04-medium"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </aside>
        </div>
      ) : null}

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-surface border-b border-outline px-20 lg:px-32 py-15 flex items-center justify-between gap-20">
          <div className="flex items-center gap-15">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden w-9 h-9 rounded-md border border-outline hover:bg-surface-subtle flex items-center justify-center text-on-surface"
            >
              <Menu className="w-4 h-4" aria-hidden="true" />
            </button>
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 font-t05 text-t05 text-on-surface-variant"
            >
              <Link
                to="/"
                className="hover:text-on-surface transition-colors duration-instant ease-instant"
              >
                DocuMind
              </Link>
              <span aria-hidden="true">/</span>
              <span className="text-on-surface" aria-current="page">
                {currentTitle}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-15">
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Open quick search palette"
              className="hidden sm:flex items-center justify-between gap-2 w-72 md:w-80 lg:w-96 px-3 py-1.5 rounded-md bg-surface-subtle border border-outline text-on-surface-variant hover:bg-surface hover:border-outline-focus font-t04 text-t04 transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Search documents or clauses...</span>
              </span>
              <kbd className="px-1.5 py-0.5 rounded-xs border border-outline bg-surface text-on-surface-variant font-mono text-mono-sm shrink-0">
                ⌘K
              </kbd>
            </button>

            <Link
              to="/settings"
              aria-label="Workspace settings"
              title={user ? `${user.name} (${user.organization})` : 'Profile settings'}
              className="w-8 h-8 rounded-pill bg-secondary text-on-secondary flex items-center justify-center font-t05 text-t05 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus shrink-0"
            >
              {getInitials(user?.name)}
            </Link>
          </div>
        </header>

        <main className="flex-1 px-20 lg:px-32 py-32 flex flex-col gap-32 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
