import { Search } from 'lucide-react';
import { cn } from '../../../core/lib/utils';

export type HistoryScopeFilter = 'all' | 'global' | 'single';

interface HistoryFilterBarProps {
  scopeFilter: HistoryScopeFilter;
  searchQuery: string;
  onScopeChange: (scope: HistoryScopeFilter) => void;
  onSearchChange: (query: string) => void;
}

const SCOPE_TABS: ReadonlyArray<{ id: HistoryScopeFilter; label: string }> = [
  { id: 'all', label: 'All Sessions' },
  { id: 'global', label: 'Knowledge Base' },
  { id: 'single', label: 'Single Document' },
];

/**
 * Segmented scope filter tabs and live thread search input matching the Stitch layout.
 */
export function HistoryFilterBar({
  scopeFilter,
  searchQuery,
  onScopeChange,
  onSearchChange,
}: HistoryFilterBarProps) {
  return (
    <section
      aria-label="Filter Sessions"
      className="flex flex-col md:flex-row md:items-center justify-between gap-15"
    >
      <div
        role="tablist"
        aria-label="Session Scope Filter"
        className="inline-flex flex-wrap items-center gap-1 p-1 rounded-soft bg-surface-subtle border border-outline self-start"
      >
        {SCOPE_TABS.map((tab) => {
          const isActive = scopeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onScopeChange(tab.id)}
              className={cn(
                'px-15 py-1.5 rounded-soft font-t04 text-t04-medium transition-colors duration-standard ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus',
                isActive
                  ? 'bg-surface text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="relative w-full md:w-72">
        <label htmlFor="history-filter-input" className="sr-only">
          Filter chat sessions
        </label>
        <Search
          className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          id="history-filter-input"
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter past threads or files..."
          className="w-full pl-9 pr-3 py-1.5 rounded-md bg-surface border border-outline text-on-surface placeholder:text-on-surface-variant font-t04 text-t04 focus:outline-none focus:border-outline-focus focus:ring-1 focus:ring-outline-focus"
        />
      </div>
    </section>
  );
}
