import { useState, type DragEvent } from 'react';
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react';
import { cn } from '../../../core/lib/utils';
import {
  useDocumentUploadStore,
  type ActiveIngestionItem,
} from '../stores/useDocumentUploadStore';
import { formatFileSize } from '../utils/formatters';

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
}

function StagePipeline({ item }: { item: ActiveIngestionItem }) {
  if (item.stage === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 font-t05 text-t05 text-status-failed-text">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{item.errorMessage || 'Ingestion failed'}</span>
      </span>
    );
  }

  const extractingDone =
    item.stage === 'CHUNKING' ||
    item.stage === 'EMBEDDING' ||
    item.stage === 'COMPLETED';
  const indexingDone = item.stage === 'COMPLETED';
  const isIndexing = item.stage === 'CHUNKING' || item.stage === 'EMBEDDING';

  return (
    <div className="flex flex-wrap items-center gap-2 font-t05 text-t05">
      <span
        className={cn(
          'inline-flex items-center gap-1',
          extractingDone
            ? 'text-status-ready-text'
            : 'text-status-processing-text'
        )}
      >
        {extractingDone ? (
          <Check className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        )}
        <span>Extracting text</span>
      </span>
      <span className="text-on-surface-variant" aria-hidden="true">
        →
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-1',
          indexingDone
            ? 'text-status-ready-text'
            : isIndexing
              ? 'text-status-processing-text'
              : 'text-on-surface-variant'
        )}
      >
        {indexingDone ? (
          <Check className="w-3.5 h-3.5" aria-hidden="true" />
        ) : isIndexing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        ) : null}
        <span>Indexing coordinates</span>
      </span>
      <span className="text-on-surface-variant" aria-hidden="true">
        →
      </span>
      <span
        className={
          indexingDone ? 'text-status-ready-text font-medium' : 'text-on-surface-variant'
        }
      >
        Ready
      </span>
    </div>
  );
}

/**
 * Multi-file drag-and-drop dropzone with duplicate conflict banner and live SSE stage progress.
 */
export function UploadDropzone({
  onFilesSelected,
  isUploading,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const queue = useDocumentUploadStore((s) => s.queue);
  const duplicateNotice = useDocumentUploadStore((s) => s.duplicateNotice);
  const setDuplicateNotice = useDocumentUploadStore((s) => s.setDuplicateNotice);
  const dismissQueueItem = useDocumentUploadStore((s) => s.dismissQueueItem);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) {
      onFilesSelected(dropped);
    }
  };

  return (
    <section aria-label="File Ingestion Dropzone" className="flex flex-col gap-15">
      {duplicateNotice ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-15 px-20 py-15 rounded-md bg-status-failed-bg text-status-failed-text border border-status-failed-border"
        >
          <div className="flex items-center gap-15 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <p className="font-t04 text-t04">
              <strong className="font-t04-medium">Duplicate detected:</strong>{' '}
              <span className="font-mono text-mono-sm">{duplicateNotice.filename}</span>{' '}
              (SHA-256 match) already exists in your workspace. Upload skipped.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDuplicateNotice(null)}
            aria-label="Dismiss duplicate alert"
            className="p-1 rounded-pill hover:bg-surface transition-colors duration-instant ease-instant shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'bg-surface border-2 border-dashed rounded-card p-32 flex flex-col gap-20 transition-colors duration-instant ease-instant',
          isDragging
            ? 'border-primary bg-surface-accent-subtle'
            : 'border-outline'
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-20">
          <div className="flex items-center gap-15">
            <span className="w-12 h-12 rounded-card bg-surface-subtle text-on-surface flex items-center justify-center shrink-0">
              <UploadCloud className="w-6 h-6" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="font-t03 text-t03 text-on-surface">
                Drop files here or browse to ingest
              </h2>
              <p className="font-t04 text-t04 text-on-surface-variant">
                Supports single or batch uploads of PDF, DOCX, XLSX, and PPTX up to 25 MB per file.
              </p>
            </div>
          </div>

          <label
            htmlFor="dropzone-file-input"
            className={cn(
              'cursor-pointer inline-flex items-center justify-center px-20 py-2.5 rounded-md border border-outline bg-surface text-on-surface font-t04 text-t04-medium hover:bg-surface-subtle transition-colors duration-instant ease-instant shrink-0',
              isUploading ? 'opacity-60 pointer-events-none' : undefined
            )}
          >
            <span>Browse Files</span>
            <input
              id="dropzone-file-input"
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.pptx"
              disabled={isUploading}
              className="sr-only"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                if (picked.length > 0) onFilesSelected(picked);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        {queue.length > 0 ? (
          <div
            className="flex flex-col gap-15 pt-15 border-t border-outline"
            aria-live="polite"
          >
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-15"
              >
                <div className="flex items-center gap-15 min-w-0">
                  <FileText
                    className="w-4 h-4 text-on-surface-variant shrink-0"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-t04 text-t04-medium text-on-surface truncate">
                      {item.filename}
                    </span>
                    <span className="font-t05 text-t05 text-on-surface-variant tabular-nums">
                      {formatFileSize(item.fileSize)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-15">
                  <StagePipeline item={item} />
                  {(item.stage === 'COMPLETED' || item.stage === 'FAILED') ? (
                    <button
                      type="button"
                      onClick={() => dismissQueueItem(item.id)}
                      aria-label={`Dismiss ${item.filename}`}
                      className="p-1 rounded-pill text-on-surface-variant hover:text-on-surface hover:bg-surface-subtle"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
