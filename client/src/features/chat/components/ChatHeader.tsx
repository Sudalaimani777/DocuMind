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
    <section className="flex flex-col gap-20 border-b border-outline pb-20">
      <div className="flex items-start justify-between gap-15">
        <div className="flex flex-col gap-1">
          <h1 className="font-t00 text-t00 text-on-surface tracking-tight text-balance">
            AI Document Assistant
          </h1>
          <p className="font-t04 text-t04 text-on-surface-variant text-pretty">
            Citation-grounded synthesis across corporate contracts, balance sheets, and decks.
          </p>
        </div>

        {hasActiveConversation ? (
          <button
            type="button"
            onClick={onNewChat}
            className="inline-flex items-center gap-1.5 px-15 py-2 rounded-md border border-outline bg-surface text-on-surface hover:bg-surface-subtle font-t04 text-t04-medium transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus shrink-0"
          >
            <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
            <span>New Chat</span>
          </button>
        ) : null}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-15">
        <div className="flex flex-col sm:flex-row sm:items-center gap-15">
          <div
            role="tablist"
            aria-label="Knowledge Scope"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-soft bg-surface-subtle border border-outline self-start"
          >
            <button
              type="button"
              role="tab"
              aria-selected={scopeMode === 'global'}
              onClick={onSelectGlobal}
              className={cn(
                'px-15 py-2 rounded-soft font-t04 text-t04-medium transition-colors duration-standard ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus',
                scopeMode === 'global'
                  ? 'bg-surface text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              Entire Corporate Knowledge Base
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scopeMode === 'single'}
              onClick={onSelectSingleMode}
              className={cn(
                'px-15 py-2 rounded-soft font-t04 text-t04-medium transition-colors duration-standard ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus',
                scopeMode === 'single'
                  ? 'bg-surface text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              Single Specific Document
            </button>
          </div>

          {scopeMode === 'single' ? (
            <div className="sm:w-80">
              <label htmlFor="chat-document-scope" className="sr-only">
                Select specific document
              </label>
              <select
                id="chat-document-scope"
                aria-label="Document scope"
                value={scopedDocumentId ?? ''}
                onChange={(e) => onSelectDocument(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-surface border border-outline text-on-surface font-t04 text-t04 focus:outline-none focus:border-outline-focus focus:ring-1 focus:ring-outline-focus"
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

        <span className="font-mono text-mono-sm text-on-surface-variant">
          {scopeMode === 'single'
            ? 'Single Document'
            : `${indexedDocuments.length} indexed documents`}
        </span>
      </div>
    </section>
  );
}
