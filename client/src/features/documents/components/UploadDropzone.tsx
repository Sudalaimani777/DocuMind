import { useCallback, useState } from 'react';
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from '../../../components/ui/toast';
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadItemProgress,
  FileUploadList,
  FileUploadTrigger,
} from '../../../components/ui/file-upload';
import { cn } from '../../../core/lib/utils';
import {
  useDocumentUploadStore,
  type ActiveIngestionItem,
} from '../stores/useDocumentUploadStore';
import { formatFileSize } from '../utils/formatters';

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => Promise<boolean | void> | void;
  isUploading: boolean;
}

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_FILES_PER_BATCH = 10;

function StagePipeline({ item }: { item: ActiveIngestionItem }) {
  if (item.stage === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 font-t05 text-t05 text-status-failed-text">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{item.errorMessage || 'Upload failed'}</span>
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
        <span>Reading text</span>
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
        <span>Indexing</span>
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
 * Multi-file drag-and-drop dropzone built with @diceui/file-upload (circular progress previews),
 * duplicate conflict alert, and live SSE processing stage indicators.
 */
export function UploadDropzone({
  onFilesSelected,
  isUploading,
}: UploadDropzoneProps) {
  const [files, setFiles] = useState<File[]>([]);
  const queue = useDocumentUploadStore((s) => s.queue);
  const duplicateNotice = useDocumentUploadStore((s) => s.duplicateNotice);
  const setDuplicateNotice = useDocumentUploadStore((s) => s.setDuplicateNotice);
  const dismissQueueItem = useDocumentUploadStore((s) => s.dismissQueueItem);

  const handleUpload = useCallback(
    async (
      acceptedFiles: File[],
      {
        onProgress,
        onSuccess,
        onError,
      }: {
        onProgress: (file: File, progress: number) => void;
        onSuccess: (file: File) => void;
        onError: (file: File, error: Error) => void;
      }
    ) => {
      for (const file of acceptedFiles) {
        onProgress(file, 35);
      }

      try {
        const result = await onFilesSelected(acceptedFiles);
        if (result === false) {
          const err = new Error('Upload failed.');
          for (const file of acceptedFiles) {
            onError(file, err);
          }
          return;
        }
        for (const file of acceptedFiles) {
          onProgress(file, 100);
          onSuccess(file);
        }
        window.setTimeout(() => {
          setFiles((prev) => prev.filter((f) => !acceptedFiles.includes(f)));
        }, 900);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Upload failed.');
        for (const file of acceptedFiles) {
          onError(file, error);
        }
      }
    },
    [onFilesSelected]
  );

  const handleFileReject = useCallback((file: File, message: string) => {
    const shortName = file.name.length > 24 ? `${file.name.slice(0, 24)}...` : file.name;
    toast.error(message, {
      description: `"${shortName}" was not accepted.`,
    });
  }, []);

  return (
    <section aria-label="File Ingestion Dropzone" className="flex flex-col gap-3">
      {duplicateNotice ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-md bg-status-failed-bg text-status-failed-text border border-status-failed-border"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <p className="font-t04 text-t04">
              <strong className="font-t04-medium">Duplicate detected:</strong>{' '}
              <span className="font-mono text-mono-sm">{duplicateNotice.filename}</span>{' '}
              already exists in your workspace. Upload skipped.
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

      <FileUpload
        value={files}
        onValueChange={setFiles}
        inputId="dropzone-file-input"
        accept=".pdf,.docx,.xlsx,.pptx"
        maxFiles={MAX_FILES_PER_BATCH}
        maxSize={MAX_FILE_SIZE_BYTES}
        disabled={isUploading}
        onUpload={handleUpload}
        onFileReject={handleFileReject}
        multiple
        className="w-full"
      >
        <FileUploadDropzone className="w-full py-5 px-5">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div className="flex items-center justify-center w-9 h-9 rounded-full border border-outline bg-surface-subtle/60 text-on-surface">
              <Upload className="w-4 h-4" aria-hidden="true" />
            </div>
            <p className="font-t04 text-t04 font-semibold text-on-surface">
              Drag &amp; drop files here
            </p>
            <p className="font-t05 text-t05 text-on-surface-variant font-normal">
              PDF, Word, Excel, or PowerPoint (max 10 files, up to 25 MB each)
            </p>
          </div>
          <FileUploadTrigger
            render={(triggerProps) => (
              <button
                type="button"
                {...triggerProps}
                className="mt-2 inline-flex items-center justify-center px-3.5 py-1.5 rounded-md border border-outline bg-surface text-on-surface font-t04 text-t04-medium hover:bg-surface-subtle transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
              >
                Browse files
              </button>
            )}
          />
        </FileUploadDropzone>

        <FileUploadList orientation="horizontal" className="pt-1">
          {files.map((file, index) => (
            <FileUploadItem
              key={`${file.name}-${file.size}-${index}`}
              value={file}
              className="p-0 relative border-outline bg-surface rounded-md"
            >
              <FileUploadItemPreview className="size-16 rounded-md [&>svg]:size-8">
                <FileUploadItemProgress variant="circular" size={36} />
              </FileUploadItemPreview>
              <FileUploadItemMetadata className="sr-only" />
              <FileUploadItemDelete
                render={(deleteProps) => (
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    {...deleteProps}
                    className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-secondary text-on-secondary hover:bg-primary flex items-center justify-center shadow-xs transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                )}
              />
            </FileUploadItem>
          ))}
        </FileUploadList>
      </FileUpload>

      {queue.length > 0 ? (
        <div
          className="bg-surface border border-outline rounded-md divide-y divide-outline"
          aria-live="polite"
        >
          {queue.map((item) => (
            <div
              key={item.id}
              className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText
                  className="w-4 h-4 text-on-surface-variant shrink-0"
                  aria-hidden="true"
                />
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-t04 text-t04-medium text-on-surface truncate">
                    {item.filename}
                  </span>
                  <span className="font-t05 text-t05 text-on-surface-variant tabular-nums shrink-0">
                    {formatFileSize(item.fileSize)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StagePipeline item={item} />
                {item.stage === 'COMPLETED' || item.stage === 'FAILED' ? (
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
    </section>
  );
}
