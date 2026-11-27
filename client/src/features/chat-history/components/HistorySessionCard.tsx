import { ArrowRight, Trash2 } from 'lucide-react';
import type { ChatSessionDTO } from '@documind/shared';

interface HistorySessionCardProps {
  session: ChatSessionDTO;
  relativeTimeLabel: string;
  onResume: (session: ChatSessionDTO) => void;
  onDelete: (session: ChatSessionDTO) => void;
}

/**
 * Single-column session list row with direct Resume and Delete actions.
 */
export function HistorySessionCard({
  session,
  relativeTimeLabel,
  onResume,
  onDelete,
}: HistorySessionCardProps) {
  const isGlobal = session.documentId === null;
  const scopeLabel = isGlobal
    ? 'All Documents'
    : session.documentTitle ?? 'Single Document';
  const countLabel =
    session.messageCount === 1 ? '1 message' : `${session.messageCount} messages`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-surface-subtle/50 transition-colors duration-instant ease-instant">
      <button
        type="button"
        onClick={() => onResume(session)}
        className="flex-1 min-w-0 text-left flex flex-col gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
      >
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-t04 text-t04 font-semibold text-on-surface truncate">
            {session.title}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isGlobal ? (
            <span className="font-t05 text-t05 text-secondary bg-surface-accent-subtle px-2 py-0.5 rounded-pill">
              {scopeLabel}
            </span>
          ) : (
            <span className="font-t05 text-t05 text-on-surface bg-surface-subtle border border-outline px-2 py-0.5 rounded-pill">
              {scopeLabel}
            </span>
          )}
          <span className="font-t05 text-t05 text-on-surface-variant tabular-nums">
            {countLabel}
          </span>
          <span className="text-on-surface-variant" aria-hidden="true">
            ·
          </span>
          <time
            dateTime={session.updatedAt}
            className="font-t05 text-t05 text-on-surface-variant tabular-nums"
          >
            {relativeTimeLabel}
          </time>
        </div>
      </button>

      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        <button
          type="button"
          onClick={() => onResume(session)}
          aria-label={`Resume ${session.title}`}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-outline bg-surface text-on-surface hover:bg-surface-subtle font-t05 text-t05 transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
        >
          <span>Resume</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(session)}
          aria-label={`Delete ${session.title}`}
          className="inline-flex items-center justify-center p-1.5 rounded-md text-on-surface-variant hover:text-status-failed-text hover:bg-status-failed-bg transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
