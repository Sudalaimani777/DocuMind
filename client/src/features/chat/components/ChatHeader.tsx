import { MessageSquarePlus } from 'lucide-react';
import type { DocumentDTO } from '@documind/shared';
import { cn } from '../../../core/lib/utils';

interface ChatHeaderProps {
  scopeMode: 'global' | 'single';
  scopedDocumentId: string | null;
  indexedDocuments: DocumentDTO[];
  hasActiveConversation: boolean;
  onSelectGlobal: () => void;
  onSelectSingleMode: () => void;
  onSelectDocument: (documentId: string) => void;
  onNewChat: () => void;
}

/**
 * Editorial page header with segmented knowledge scope tabs and optional single-document picker.
 */
export function ChatHeader({
  scopeMode,
  scopedDocumentId,
  indexedDocuments,
  hasActiveConversation,
  onSelectGlobal,
  onSelectSingleMode,
  onSelectDocument,
  onNewChat,
}: ChatHeaderProps) {
  return (
    <section className="flex flex-col gap-3.5 border-b border-outline pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-t01 text-t01 text-on-surface tracking-tight text-balance">
            AI Assistant
          </h1>
          <p className="font-t04 text-t04 text-on-surface-variant text-pretty">
            Ask questions across your documents with verified page references.
          </p>
        </div>

        {hasActiveConversation ? (
          <button
            type="button"
            onClick={onNewChat}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-outline bg-surface text-on-surface hover:bg-surface-subtle font-t04 text-t04-medium transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus shrink-0"
          >
            <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
            <span>New Chat</span>
          </button>
        ) : null}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div
            role="tablist"
            aria-label="Knowledge Scope"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-md bg-surface-subtle border border-outline self-start"
          >
            <button
              type="button"
              role="tab"
              aria-selected={scopeMode === 'global'}
              onClick={onSelectGlobal}
              className={cn(
                'px-3 py-1 rounded-md font-t05 text-t05 transition-colors duration-standard ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus',
                scopeMode === 'global'
                  ? 'bg-surface text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              All Documents
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scopeMode === 'single'}
              onClick={onSelectSingleMode}
              className={cn(
                'px-3 py-1 rounded-md font-t05 text-t05 transition-colors duration-standard ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus',
                scopeMode === 'single'
                  ? 'bg-surface text-on-surface shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              Single Document
            </button>
          </div>

          {scopeMode === 'single' ? (
            <div className="sm:w-72">
              <label htmlFor="chat-document-scope" className="sr-only">
                Select specific document
              </label>
              <select
                id="chat-document-scope"
                aria-label="Document scope"
                value={scopedDocumentId ?? ''}
                onChange={(e) => onSelectDocument(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md bg-surface border border-outline text-on-surface font-t04 text-t04 focus:outline-none focus:border-outline-focus focus:ring-1 focus:ring-outline-focus"
              >
                <option value="">Select a document...</option>
                {indexedDocuments.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title || doc.originalFilename}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <span className="font-t05 text-t05 text-on-surface-variant tabular-nums">
          {scopeMode === 'single'
            ? 'Single document'
            : `${indexedDocuments.length} ${indexedDocuments.length === 1 ? 'document' : 'documents'} ready`}
        </span>
      </div>
    </section>
  );
}
