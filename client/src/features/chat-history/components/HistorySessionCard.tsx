import type { ChatSessionDTO } from '@documind/shared';
import { cn } from '../../../core/lib/utils';

interface HistorySessionCardProps {
  session: ChatSessionDTO;
  isSelected: boolean;
  relativeTimeLabel: string;
  onSelect: (session: ChatSessionDTO) => void;
}

/**
 * Selectable session card matching the Stitch Chat History list item.
 */
export function HistorySessionCard({
  session,
  isSelected,
  relativeTimeLabel,
  onSelect,
}: HistorySessionCardProps) {
  const isGlobal = session.documentId === null;
  const scopeLabel = isGlobal
    ? 'Corporate Knowledge Base'
    : session.documentTitle ?? 'Scoped Document';
  const countLabel =
    session.messageCount === 1 ? '1 message' : `${session.messageCount} messages`;

  return (
    <button
      type="button"
      onClick={() => onSelect(session)}
      aria-pressed={isSelected}
      className={cn(
        'w-full text-left bg-surface rounded-card p-15 flex flex-col gap-2 transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus border',
        isSelected
          ? 'border-primary shadow-sm'
          : 'border-outline hover:border-outline-focus'
      )}
    >
      <div className="flex items-start justify-between gap-15">
        <h3 className="font-t03 text-t03 text-on-surface text-balance">{session.title}</h3>
        <time
          dateTime={session.updatedAt}
          className="font-mono text-mono-sm text-on-surface-variant shrink-0"
        >
          {relativeTimeLabel}
        </time>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {isGlobal ? (
          <span className="font-mono text-mono-sm text-secondary bg-surface-accent-subtle px-2 py-0.5 rounded-pill">
            {scopeLabel}
          </span>
        ) : (
          <span className="font-mono text-mono-sm text-on-surface bg-surface-subtle border border-outline px-2 py-0.5 rounded-pill">
            {scopeLabel}
          </span>
        )}
        <span className="font-mono text-mono-sm text-on-surface-variant">{countLabel}</span>
      </div>
    </button>
  );
}
