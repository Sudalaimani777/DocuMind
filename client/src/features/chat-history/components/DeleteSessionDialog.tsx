import { useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { ChatSessionDTO } from '@documind/shared';

interface DeleteSessionDialogProps {
  session: ChatSessionDTO | null;
  isDeleting: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Accessible confirmation modal for permanently deleting a chat session and its messages.
 */
export function DeleteSessionDialog({
  session,
  isDeleting,
  errorMessage,
  onCancel,
  onConfirm,
}: DeleteSessionDialogProps) {
  useEffect(() => {
    if (!session) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, isDeleting, onCancel]);

  if (!session) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-20 bg-pitch/40"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-session-title"
      aria-describedby="delete-session-description"
    >
      <div className="w-full max-w-md bg-surface border border-outline rounded-card p-20 flex flex-col gap-15 shadow-lg">
        <div className="flex flex-col gap-1">
          <h2 id="delete-session-title" className="font-t02 text-t02 text-on-surface">
            Delete Conversation?
          </h2>
          <p id="delete-session-description" className="font-t04 text-t04 text-on-surface-variant">
            This will permanently delete{' '}
            <span className="font-t04-medium text-on-surface">{session.title}</span> and all of
            its messages. This action cannot be undone.
          </p>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-center gap-2 p-15 rounded-md border border-status-failed-border bg-status-failed-bg text-status-failed-text font-t05 text-t05"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-15 pt-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="px-15 py-2 rounded-md border border-outline bg-surface text-on-surface hover:bg-surface-subtle font-t04 text-t04-medium disabled:opacity-50 transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-15 py-2 rounded-md bg-secondary text-on-secondary hover:bg-primary hover:text-on-primary font-t04 text-t04-medium disabled:opacity-50 transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
            <span>{isDeleting ? 'Deleting...' : 'Delete Session'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
