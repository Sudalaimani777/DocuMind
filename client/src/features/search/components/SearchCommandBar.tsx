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
      className="bg-surface border border-outline rounded-md p-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 focus-within:border-outline-focus focus-within:ring-1 focus-within:ring-outline-focus"
    >
      <div className="relative flex-1 flex items-center">
        <label htmlFor="clause-query-input" className="sr-only">
          Search documents
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
          placeholder="Ask a question or enter a phrase (e.g., termination notice)..."
          className="w-full pl-9 pr-3 py-1.5 rounded-md border-0 bg-surface text-on-surface placeholder:text-on-surface-variant font-t04 text-t04 focus:outline-none focus:ring-0"
        />
      </div>
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md bg-secondary text-on-secondary font-t04 text-t04-medium hover:bg-primary active:scale-[0.98] transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus shrink-0"
      >
        <span>Search</span>
      </button>
    </form>
  );
}
