import { useMemo } from 'react';
import { ArrowRight, Loader2, Trash2 } from 'lucide-react';
import type { ChatSessionDTO, CoordinatesDTO } from '@documind/shared';
import { useChatMessages } from '../../chat/hooks/useChatHistory';

interface SessionPreviewPanelProps {
  session: ChatSessionDTO | null;
  userName: string;
  relativeTimeLabel: string;
  onResume: (session: ChatSessionDTO) => void;
  onRequestDelete: (session: ChatSessionDTO) => void;
}

function formatShortRef(coords: CoordinatesDTO): string {
  if (coords.pageNumber !== undefined) return `p.${coords.pageNumber}`;
  if (coords.rowStart !== undefined && coords.rowEnd !== undefined) {
    return `R${coords.rowStart}–${coords.rowEnd}`;
  }
  if (coords.slideNumber !== undefined) return `s.${coords.slideNumber}`;
  return 'excerpt';
}

/**
 * Sticky right-hand Session Preview inspector matching the Stitch design:
 * loads the selected thread's latest synthesis, referenced documents, Resume Thread CTA, and delete action.
 */
export function SessionPreviewPanel({
  session,
  userName,
  relativeTimeLabel,
  onResume,
  onRequestDelete,
}: SessionPreviewPanelProps) {
  const messagesQuery = useChatMessages(session?.id ?? null);

  const { summaryText, citedDocs, totalCitations } = useMemo(() => {
    const msgs = messagesQuery.data ?? [];
    const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant');
    const allCitations = msgs.flatMap((m) => m.citations);
    const seen = new Set<string>();
    const refs: string[] = [];

    for (const c of allCitations) {
      const label = `${c.documentTitle} (${formatShortRef(c.coordinates)})`;
      if (!seen.has(label)) {
        seen.add(label);
        refs.push(label);
      }
    }

    return {
      summaryText: lastAssistant?.content ?? null,
      citedDocs: refs,
      totalCitations: allCitations.length,
    };
  }, [messagesQuery.data]);

  if (!session) {
    return (
      <aside
        aria-label="Session Preview"
        className="lg:col-span-5 lg:sticky lg:top-24 bg-surface-subtle border border-outline rounded-card p-20 flex flex-col gap-15 text-center"
      >
        <h2 className="font-t03 text-t03 text-on-surface">Session Preview</h2>
        <p className="font-t04 text-t04 text-on-surface-variant">
          Select a conversation thread on the left to inspect its summary and referenced documents.
        </p>
      </aside>
    );
  }

  const scopeLabel =
    session.documentId === null
      ? 'Corporate Knowledge Base'
      : session.documentTitle ?? 'Scoped Document';
  const badgeText =
    totalCitations > 0
      ? `${totalCitations} ${totalCitations === 1 ? 'citation' : 'citations'}`
      : `${session.messageCount} ${session.messageCount === 1 ? 'message' : 'messages'}`;

  return (
    <aside
      aria-label="Session Preview"
      className="lg:col-span-5 lg:sticky lg:top-24 bg-surface-subtle border border-outline rounded-card p-20 flex flex-col gap-20"
    >
      <header className="flex items-center justify-between gap-15 border-b border-outline pb-15">
        <div className="flex flex-col">
          <h2 className="font-t03 text-t03 text-on-surface">Session Preview</h2>
          <span className="font-t05 text-t05 text-on-surface-variant">
            {userName} · {relativeTimeLabel}
          </span>
        </div>
        <span className="font-mono text-mono-sm text-status-ready-text bg-status-ready-bg border border-status-ready-border px-2 py-0.5 rounded-pill shrink-0">
          {badgeText}
        </span>
      </header>

      <div className="bg-surface border border-outline rounded-md p-15 flex flex-col gap-15">
        <span className="font-mono text-mono-sm text-secondary">{scopeLabel}</span>
        <h3 className="font-t03 text-t03 text-on-surface text-balance">{session.title}</h3>

        {messagesQuery.isLoading ? (
          <div className="py-15 flex items-center gap-2 font-t04 text-t04 text-on-surface-variant">
            <Loader2 className="w-4 h-4 animate-spin text-secondary" aria-hidden="true" />
            <span>Loading thread preview...</span>
          </div>
        ) : summaryText ? (
          <p className="font-t04 text-t04 text-on-surface-variant text-pretty line-clamp-5">
            {summaryText}
          </p>
        ) : (
          <p className="font-t04 text-t04 text-on-surface-variant">
            Resume this thread to continue your grounded conversation.
          </p>
        )}

        {citedDocs.length > 0 ? (
          <div className="border-t border-outline pt-15 flex flex-col gap-2">
            <span className="font-t05 text-t05 text-on-surface-variant">Referenced Documents</span>
            <ul className="flex flex-col gap-1 font-mono text-mono-sm text-on-surface">
              {citedDocs.map((docRef) => (
                <li key={docRef}>· {docRef}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-15">
        <button
          type="button"
          onClick={() => onResume(session)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-15 py-2.5 rounded-md bg-secondary text-on-secondary font-t04 text-t04-medium hover:bg-primary hover:text-on-primary transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
        >
          <span>Resume Thread</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onRequestDelete(session)}
          aria-label={`Delete ${session.title}`}
          className="px-3 py-2.5 rounded-md bg-surface border border-outline text-on-surface-variant hover:text-on-surface hover:border-outline-focus transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
