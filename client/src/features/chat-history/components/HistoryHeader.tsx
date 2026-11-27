import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

/**
 * Editorial page header for Chat History with primary CTA to start a new AI chat.
 */
export function HistoryHeader() {
  return (
    <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-outline pb-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-t01 text-t01 text-on-surface tracking-tight text-balance">
          Chat History
        </h1>
        <p className="font-t04 text-t04 text-on-surface-variant text-pretty">
          Review and continue your past conversations.
        </p>
      </div>

      <Link
        to="/chat"
        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-md bg-secondary text-on-secondary font-t04 text-t04-medium hover:bg-primary transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus shrink-0 self-start sm:self-auto"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        <span>New Chat</span>
      </Link>
    </section>
  );
}
