import { Search } from 'lucide-react';
import { useSearchStore } from '../store/searchStore';

interface SearchCommandBarProps {
  onSubmitQuery: () => void;
}

/**
 * Isolated search input bar subscribing to raw query state so keystrokes
 * do not re-render the sidebar or results feed before the 300ms debounce settles.
 */
export function SearchCommandBar({ onSubmitQuery }: SearchCommandBarProps) {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitQuery();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border border-outline rounded-card p-15 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-15"
    >
      <div className="relative flex-1 flex items-center">
        <label htmlFor="clause-query-input" className="sr-only">
          Search clauses and documents
        </label>
        <Search
          className="w-4 h-4 text-on-surface-variant absolute left-3 pointer-events-none"
          aria-hidden="true"
        />
        <input
          id="clause-query-input"
          type="text"
          role="searchbox"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a natural language question or enter an exact clause code (e.g., Clause 8.2)..."
          className="w-full pl-10 pr-3 py-2.5 rounded-md border-0 bg-surface text-on-surface placeholder:text-on-surface-variant font-t03 text-t03 focus:outline-none focus:ring-0"
        />
      </div>
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 px-20 py-15 min-h-[48px] rounded-md bg-secondary text-on-secondary font-t03 text-t03 hover:bg-primary hover:text-on-primary active:scale-[0.98] transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus shrink-0"
      >
        <span>Search Repository</span>
      </button>
    </form>
  );
}
