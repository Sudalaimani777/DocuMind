import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '../../core/lib/utils';
import { FormatIcon } from '../../features/documents/components/FormatBadge';
import { useSearchQuery } from '../../features/search/hooks/useSearchQuery';
import { useSearchStore } from '../../features/search/store/searchStore';
import { formatCoordinates } from '../../features/search/utils/formatCoordinates';

/**
 * Global Cmd/Ctrl + K Spotlight quick-search palette.
 */
export function CommandPalette() {
  const navigate = useNavigate();
  const isOpen = useSearchStore((s) => s.isCommandPaletteOpen);
  const setOpen = useSearchStore((s) => s.setCommandPaletteOpen);
  const toggle = useSearchStore((s) => s.toggleCommandPalette);
  const setSelectedResult = useSearchStore((s) => s.setSelectedResult);

  const [input, setInput] = useState('');
  const [debouncedInput, setDebouncedInput] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  }, [toggle]);

  useEffect(() => {
    if (!isOpen) {
      setInput('');
      setDebouncedInput('');
      setActiveIndex(0);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();

    const timer = window.setTimeout(() => {
      setDebouncedInput(input);
      setActiveIndex(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input, isOpen]);

  const quickSearch = useSearchQuery({
    q: debouncedInput,
    mode: 'hybrid',
    limit: 6,
  });

  if (!isOpen) return null;

  const results = quickSearch.data?.results ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
      return;
    }
    if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-48 px-20 bg-pitch/30"
      role="dialog"
      aria-modal="true"
      aria-label="Quick search command palette"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-surface border border-outline rounded-card shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-15 px-20 py-15 border-b border-outline"
        >
          <Search className="w-4 h-4 text-on-surface-variant shrink-0" aria-hidden="true" />
          <label htmlFor="command-palette-input" className="sr-only">
            Quick search documents and clauses
          </label>
          <input
            ref={inputRef}
            id="command-palette-input"
            type="text"
            role="searchbox"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search clauses, tables, or press Enter for full workbench..."
            className="flex-1 bg-surface border-0 text-on-surface placeholder:text-on-surface-variant font-t03 text-t03 focus:outline-none focus:ring-0"
          />
          {quickSearch.isFetching ? (
            <Loader2 className="w-4 h-4 animate-spin text-secondary shrink-0" aria-hidden="true" />
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close quick search"
            className="p-1 rounded-md hover:bg-surface-subtle text-on-surface-variant"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>

        <div className="max-h-96 overflow-y-auto p-2">
          {!debouncedInput.trim() ? (
            <p className="px-15 py-20 font-t04 text-t04 text-on-surface-variant text-center">
              Type to quick-search across your documents, or press Enter to open Search Repository.
            </p>
          ) : results.length === 0 && !quickSearch.isFetching ? (
            <p className="px-15 py-20 font-t04 text-t04 text-on-surface-variant text-center">
              No quick matches for &ldquo;{debouncedInput.trim()}&rdquo;. Press Enter to search with filters.
            </p>
          ) : (
            <ul role="listbox" className="flex flex-col gap-1">
              {results.map((item, idx) => (
                <li key={item.chunkId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={idx === activeIndex}
                    onClick={() => {
                      setSelectedResult(item);
                      setOpen(false);
                      navigate(`/search?q=${encodeURIComponent(debouncedInput.trim())}`);
                    }}
                    className={cn(
                      'w-full text-left px-15 py-2.5 rounded-md flex items-center justify-between gap-15 transition-colors duration-instant ease-instant',
                      idx === activeIndex ? 'bg-surface-accent-subtle' : 'hover:bg-surface-subtle'
                    )}
                  >
                    <div className="min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <FormatIcon fileType={item.fileType} />
                        <span className="font-t04 text-t04-medium text-on-surface truncate">
                          {item.documentTitle}
                        </span>
                      </div>
                      <span className="pl-6 font-t05 text-t05 text-on-surface-variant truncate">
                        {formatCoordinates(item.coordinates, item.chunkIndex)}
                      </span>
                    </div>
                    <span className="font-mono text-mono-sm text-status-ready-text tabular-nums shrink-0">
                      {item.score.toFixed(3)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
