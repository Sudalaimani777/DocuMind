import { useEffect } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useDeleteDocumentMutation } from '../hooks/useDocuments';
import { useDocumentUploadStore } from '../stores/useDocumentUploadStore';

/**
 * Confirmation dialog for permanent document, chunk, and Cloudinary deletion.
 */
export function DeleteDocumentDialog() {
  const deleteTarget = useDocumentUploadStore((s) => s.deleteTarget);
  const closeDeleteDialog = useDocumentUploadStore((s) => s.closeDeleteDialog);
  const deleteMutation = useDeleteDocumentMutation();

  useEffect(() => {
    if (!deleteTarget) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleteMutation.isPending) {
        closeDeleteDialog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteTarget, deleteMutation.isPending, closeDeleteDialog]);

  if (!deleteTarget) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-20 bg-pitch/20"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="w-full max-w-md bg-surface border border-outline rounded-card p-32 flex flex-col gap-20">
        <header className="flex items-center gap-15">
          <span className="w-10 h-10 rounded-pill bg-status-failed-bg text-status-failed-text border border-status-failed-border flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </span>
          <h2 id="delete-dialog-title" className="font-t01 text-t01 text-on-surface">
            Delete Document?
          </h2>
        </header>

        <p className="font-t04 text-t04 text-on-surface-variant text-pretty">
          Are you sure you want to permanently remove{' '}
          <strong className="font-t04-medium text-on-surface">
            {deleteTarget.originalFilename}
          </strong>{' '}
          and all its indexed vector chunks? This action cannot be undone.
        </p>

        <footer className="flex items-center justify-end gap-15 pt-15 border-t border-outline">
          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={closeDeleteDialog}
            className="px-20 py-15 rounded-md bg-surface text-on-surface border border-outline hover:bg-surface-subtle font-t04 text-t04-medium transition-colors duration-instant ease-instant disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={() => void deleteMutation.mutateAsync(deleteTarget.id)}
            className="px-20 py-15 rounded-md bg-status-failed-text text-on-secondary font-t04 text-t04-medium hover:opacity-90 transition-opacity duration-instant ease-instant disabled:opacity-60 inline-flex items-center gap-2"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Deleting...</span>
              </>
            ) : (
              'Delete Permanently'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
