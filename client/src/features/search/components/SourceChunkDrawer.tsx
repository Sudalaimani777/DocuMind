import { ExternalLink, X } from 'lucide-react';
import type { SearchResultItemDTO } from '@documind/shared';
import { Drawer } from '../../../components/layout/Drawer';
import { formatCoordinates } from '../../../core/lib/formatCoordinates';
import { FormatBadge } from '../../documents/components/FormatBadge';

interface SourceChunkDrawerProps {
  result: SearchResultItemDTO | null;
  onClose: () => void;
}

/**
 * 480px slide-over drawer displaying full chunk text, structural coordinates,
 * score breakdown, and a link to open the original file.
 */
export function SourceChunkDrawer({ result, onClose }: SourceChunkDrawerProps) {
  const coordinateLabel = result
    ? formatCoordinates(result.coordinates, result.chunkIndex)
    : '';

  return (
    <Drawer isOpen={Boolean(result)} onClose={onClose} labelledBy="source-drawer-title">
      {result ? (
        <>
          <div className="flex flex-col gap-20">
            <header className="flex items-start justify-between gap-15 border-b border-outline pb-15">
              <div className="min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-t05 text-t05 text-secondary">
                    Source Chunk Preview
                  </span>
                  <FormatBadge fileType={result.fileType} />
                </div>
                <h2
                  id="source-drawer-title"
                  className="font-t02 text-t02 text-on-surface break-words"
                >
                  {result.documentTitle}
                </h2>
                <p className="font-t05 text-t05 text-on-surface-variant truncate">
                  {result.originalFilename}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close source preview"
                className="w-9 h-9 rounded-pill hover:bg-surface-subtle flex items-center justify-center text-on-surface transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </header>

            <div className="grid grid-cols-2 gap-15">
              <div className="border border-outline rounded-md p-15">
                <span className="font-t05 text-t05 text-on-surface-variant block">
                  Structural Coordinate
                </span>
                <span className="font-t04 text-t04-medium text-on-surface mt-1 block">
                  {coordinateLabel}
                </span>
              </div>
              <div className="border border-outline rounded-md p-15">
                <span className="font-t05 text-t05 text-on-surface-variant block">
                  Relevance Score
                </span>
                <span className="font-mono text-mono-md text-on-surface tabular-nums mt-1 block">
                  {result.score.toFixed(4)}
                </span>
                {result.lexicalScore !== undefined || result.semanticScore !== undefined ? (
                  <span className="font-t05 text-t05 text-on-surface-variant mt-0.5 block tabular-nums">
                    {result.lexicalScore !== undefined ? `Lex: ${result.lexicalScore.toFixed(2)}` : ''}
                    {result.lexicalScore !== undefined && result.semanticScore !== undefined ? ' · ' : ''}
                    {result.semanticScore !== undefined ? `Sem: ${result.semanticScore.toFixed(2)}` : ''}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-t05 text-t05 text-on-surface-variant">
                Verbatim Source Excerpt
              </span>
              <div className="bg-surface-subtle rounded-md p-15 font-t04 text-t04 text-on-surface leading-relaxed whitespace-pre-wrap">
                {result.content}
              </div>
            </div>
          </div>

          <footer className="flex items-center justify-between gap-15 pt-20 border-t border-outline">
            <a
              href={result.storageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-15 py-2.5 rounded-md border border-outline bg-surface text-on-surface hover:bg-surface-subtle font-t04 text-t04-medium transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
            >
              <span>Open Original File</span>
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="px-20 py-2.5 rounded-md bg-secondary text-on-secondary font-t04 text-t04-medium hover:bg-primary hover:text-on-primary transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
            >
              Done
            </button>
          </footer>
        </>
      ) : null}
    </Drawer>
  );
}
