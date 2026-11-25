import { useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { useDocumentDetailQuery } from '../hooks/useDocuments';
import { useDocumentUploadStore } from '../stores/useDocumentUploadStore';
import { FormatBadge } from './FormatBadge';
import { formatCoordinates, formatFileSize } from '../utils/formatters';

/**
 * 480px slide-over drawer displaying document metadata and verified extracted chunks.
 */
export function ChunkInspectorDrawer() {
  const inspectedDocumentId = useDocumentUploadStore((s) => s.inspectedDocumentId);
  const closeInspector = useDocumentUploadStore((s) => s.closeInspector);
  const { data, isLoading, isError } = useDocumentDetailQuery(inspectedDocumentId);

  useEffect(() => {
    if (!inspectedDocumentId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeInspector();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedDocumentId, closeInspector]);

  if (!inspectedDocumentId) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-pitch/20"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspect-drawer-title"
    >
      <div className="fixed inset-0" onClick={closeInspector} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-[480px] bg-surface border-l border-outline h-screen p-32 flex flex-col justify-between gap-20 overflow-y-auto">
        <div className="flex flex-col gap-20">
          <header className="flex items-start justify-between gap-15 border-b border-outline pb-15">
            <div className="min-w-0">
              <span className="font-t05 text-t05 text-secondary">
                Chunk &amp; Coordinate Inspector
              </span>
              <h2
                id="inspect-drawer-title"
                className="font-t02 text-t02 text-on-surface mt-1 break-words"
              >
                {data?.document.originalFilename ?? 'Loading document...'}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeInspector}
              aria-label="Close inspector"
              className="w-9 h-9 rounded-pill hover:bg-surface-subtle flex items-center justify-center text-on-surface transition-colors duration-instant ease-instant shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </header>

          {isLoading ? (
            <div className="py-32 flex items-center justify-center gap-2 text-on-surface-variant font-t04 text-t04">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Loading chunk previews...</span>
            </div>
          ) : isError || !data ? (
            <div className="rounded-md border border-status-failed-border bg-status-failed-bg p-15 font-t04 text-t04 text-status-failed-text">
              Could not load document chunk details.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-15">
                <div className="border border-outline rounded-md p-15">
                  <span className="font-t05 text-t05 text-on-surface-variant block">
                    Format &amp; Size
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <FormatBadge fileType={data.document.fileType} />
                    <span className="font-mono text-mono-sm text-on-surface">
                      {formatFileSize(data.document.fileSize)}
                    </span>
                  </div>
                </div>
                <div className="border border-outline rounded-md p-15">
                  <span className="font-t05 text-t05 text-on-surface-variant block">
                    Indexed Chunks
                  </span>
                  <span className="font-mono text-mono-md text-on-surface tabular-nums mt-1 block">
                    {data.document.chunkCount}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-15">
                <span className="font-t05 text-t05 text-on-surface-variant">
                  Extracted Chunks ({data.chunks.length})
                </span>
                {data.chunks.length === 0 ? (
                  <div className="bg-surface-subtle rounded-md p-15 font-t04 text-t04 text-on-surface-variant">
                    No text chunks indexed for this document yet.
                  </div>
                ) : (
                  data.chunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="border border-outline rounded-md p-15 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-pill bg-surface-subtle text-on-surface font-t05 text-t05">
                          {formatCoordinates(chunk.coordinates)}
                        </span>
                        <span className="font-mono text-mono-sm text-on-surface-variant">
                          #{chunk.chunkIndex + 1}
                        </span>
                      </div>
                      <p className="font-t04 text-t04 text-on-surface whitespace-pre-wrap break-words">
                        {chunk.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <footer className="flex items-center justify-end gap-15 pt-20 border-t border-outline">
          <button
            type="button"
            onClick={closeInspector}
            className="px-20 py-15 rounded-md bg-secondary text-on-secondary font-t04 text-t04-medium hover:bg-primary hover:text-on-primary transition-colors duration-instant ease-instant"
          >
            Close Inspector
          </button>
        </footer>
      </div>
    </div>
  );
}
