import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

/**
 * Editorial page header for Chat History with primary CTA to start a new AI chat.
 */
export function HistoryHeader() {
  return (
    <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-20 border-b border-outline pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="font-t00 text-t00 text-on-surface tracking-tight text-balance">
          Chat History
        </h1>
        <p className="font-t04 text-t04 text-on-surface-variant text-pretty">
          Revisit, audit, and resume citation-grounded conversations across your corporate repository.
        </p>
      </div>

      <Link
        to="/chat"
        className="inline-flex items-center justify-center gap-2 px-20 py-2.5 rounded-md bg-secondary text-on-secondary font-t04 text-t04-medium hover:bg-primary hover:text-on-primary transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus shrink-0 self-start sm:self-auto"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        <span>New AI Chat</span>
      </Link>
    </section>
  );
}
