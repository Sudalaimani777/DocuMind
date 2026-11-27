import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, History, Loader2 } from 'lucide-react';
import type { ChatSessionDTO } from '@documind/shared';
import { useChatSessions, useDeleteChatSession } from '../../chat/hooks/useChatHistory';
import { HistoryHeader } from '../components/HistoryHeader';
import { HistoryFilterBar, type HistoryScopeFilter } from '../components/HistoryFilterBar';
import { HistorySessionCard } from '../components/HistorySessionCard';
import { DeleteSessionDialog } from '../components/DeleteSessionDialog';

type DateGroupLabel = 'Today' | 'Yesterday' | 'Earlier';

function getDateGroupLabel(iso: string): DateGroupLabel {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return 'Earlier';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const time = target.getTime();

  if (time >= startOfToday) return 'Today';
  if (time >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
}

function formatRelativeTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return 'Recently';

  const diffMs = Date.now() - time;
  if (diffMs < 60_000) return 'Just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  if (getDateGroupLabel(iso) === 'Yesterday') return 'Yesterday';
  return new Date(iso).toLocaleDateString();
}

/**
 * Chat History view matching the Stitch two-column layout:
 * scope/search filtering, chronologically grouped session cards, sticky Session Preview,
 * one-click Resume Thread, pagination, and delete confirmation dialog.
 */
export function HistoryView() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [scopeFilter, setScopeFilter] = useState<HistoryScopeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<ChatSessionDTO | null>(null);

  const sessionsQuery = useChatSessions({ page, limit: 20 });
  const deleteMutation = useDeleteChatSession();

  const rawSessions = sessionsQuery.data?.sessions ?? [];
  const pagination = sessionsQuery.data?.pagination;

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rawSessions.filter((session) => {
      if (scopeFilter === 'global' && session.documentId !== null) return false;
      if (scopeFilter === 'single' && session.documentId === null) return false;
      if (!q) return true;
      return (
        session.title.toLowerCase().includes(q) ||
        (session.documentTitle?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rawSessions, scopeFilter, searchQuery]);

  const groupedSessions = useMemo(() => {
    const groups: Record<DateGroupLabel, ChatSessionDTO[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };
    for (const session of filteredSessions) {
      groups[getDateGroupLabel(session.updatedAt)].push(session);
    }
    return (['Today', 'Yesterday', 'Earlier'] as const)
      .filter((label) => groups[label].length > 0)
      .map((label) => ({ label, items: groups[label] }));
  }, [filteredSessions]);

  useEffect(() => {
    if (pagination && page > pagination.totalPages && pagination.totalPages >= 1) {
      setPage(pagination.totalPages);
    }
  }, [pagination, page]);

  const handleResume = (session: ChatSessionDTO) => {
    const targetPath = session.documentId
      ? `/chat/${session.documentId}?sessionId=${session.id}`
      : `/chat?sessionId=${session.id}`;
    navigate(targetPath);
  };

  const handleRequestDelete = (session: ChatSessionDTO) => {
    deleteMutation.reset();
    setSessionToDelete(session);
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    await deleteMutation.mutateAsync(sessionToDelete.id);
    setSessionToDelete(null);
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      <HistoryHeader />

      <HistoryFilterBar
        scopeFilter={scopeFilter}
        searchQuery={searchQuery}
        onScopeChange={setScopeFilter}
        onSearchChange={setSearchQuery}
      />

      {sessionsQuery.isLoading ? (
        <div className="py-12 flex items-center justify-center gap-2 font-t04 text-t04 text-on-surface-variant">
          <Loader2 className="w-4 h-4 animate-spin text-secondary" aria-hidden="true" />
          <span>Loading chat history...</span>
        </div>
      ) : sessionsQuery.isError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 p-4 rounded-md border border-status-failed-border bg-status-failed-bg text-status-failed-text font-t04 text-t04"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Failed to load chat history. Please try again.</span>
          </div>
          <button
            type="button"
            onClick={() => void sessionsQuery.refetch()}
            className="px-3 py-1.5 rounded-md border border-status-failed-border bg-surface text-on-surface font-t04 text-t04-medium hover:bg-surface-subtle"
          >
            Retry
          </button>
        </div>
      ) : rawSessions.length === 0 ? (
        <div className="py-12 px-5 border border-dashed border-outline rounded-md flex flex-col items-center text-center gap-3 bg-surface-subtle/30">
          <div className="w-10 h-10 rounded-md bg-surface border border-outline flex items-center justify-center text-secondary">
            <History className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1 max-w-sm">
            <h2 className="font-t04 text-t04 font-semibold text-on-surface">No conversations yet</h2>
            <p className="font-t05 text-t05 text-on-surface-variant font-normal">
              Ask a question in AI Chat to start your first thread.
            </p>
          </div>
          <Link
            to="/chat"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-secondary text-on-secondary font-t04 text-t04-medium hover:bg-primary transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
          >
            Start a Chat
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groupedSessions.length === 0 ? (
            <div className="p-6 border border-outline rounded-md bg-surface text-center">
              <p className="font-t04 text-t04 text-on-surface-variant">
                No matching conversations for the current filter.
              </p>
            </div>
          ) : (
            groupedSessions.map((group) => (
              <section key={group.label} className="flex flex-col gap-2">
                <h2 className="font-t05 text-t05 text-on-surface-variant uppercase tracking-wider px-1">
                  {group.label}
                </h2>
                <div className="border border-outline rounded-md divide-y divide-outline bg-surface overflow-hidden">
                  {group.items.map((session) => (
                    <HistorySessionCard
                      key={session.id}
                      session={session}
                      relativeTimeLabel={formatRelativeTime(session.updatedAt)}
                      onResume={handleResume}
                      onDelete={handleRequestDelete}
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          {pagination && pagination.totalPages > 1 ? (
            <nav
              aria-label="Chat history pagination"
              className="flex items-center justify-between pt-3 border-t border-outline"
            >
              <span className="font-t05 text-t05 text-on-surface-variant">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-md border border-outline bg-surface text-on-surface hover:bg-surface-subtle disabled:opacity-50 disabled:pointer-events-none font-t04 text-t04-medium transition-colors duration-instant ease-instant"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-md border border-outline bg-surface text-on-surface hover:bg-surface-subtle disabled:opacity-50 disabled:pointer-events-none font-t04 text-t04-medium transition-colors duration-instant ease-instant"
                >
                  Next
                </button>
              </div>
            </nav>
          ) : null}
        </div>
      )}

      <DeleteSessionDialog
        session={sessionToDelete}
        isDeleting={deleteMutation.isPending}
        errorMessage={deleteMutation.isError ? 'Failed to delete session. Please try again.' : null}
        onCancel={() => {
          deleteMutation.reset();
          setSessionToDelete(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}

export default HistoryView;
