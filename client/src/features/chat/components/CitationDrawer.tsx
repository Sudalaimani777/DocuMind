import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { X } from 'lucide-react';
import type { CitationDTO } from '@documind/shared';
import { Drawer } from '../../../components/layout/Drawer';
import { formatCoordinates } from '../../../core/lib/formatCoordinates';
import { FormatBadge } from '../../documents/components/FormatBadge';

interface CitationDrawerProps {
  citation: CitationDTO | null;
  onClose: () => void;
}

/**
 * 480px slide-over drawer displaying citation metadata, structural coordinates,
 * similarity percentage, and a DOMPurify-sanitized verbatim source excerpt.
 */
export function CitationDrawer({ citation, onClose }: CitationDrawerProps) {
  const coordinateLabel = citation ? formatCoordinates(citation.coordinates) : '';
  const similarityPercent = citation ? Math.round(citation.similarity * 100) : 0;

  const sanitizedExcerpt = useMemo(() => {
    if (!citation) return '';
    return DOMPurify.sanitize(citation.excerpt, {
      ALLOWED_TAGS: ['mark', 'b', 'strong', 'em', 'i', 'p', 'br'],
      ALLOWED_ATTR: [],
    });
  }, [citation]);

  return (
    <Drawer isOpen={Boolean(citation)} onClose={onClose} labelledBy="citation-drawer-title">
      {citation ? (
        <>
          <div className="flex flex-col gap-20">
            <header className="flex items-start justify-between gap-15 border-b border-outline pb-15">
              <div className="min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-t05 text-t05 text-secondary">
                    Source Citation [{citation.index}]
                  </span>
                  <FormatBadge fileType={citation.fileType} />
                </div>
                <h2
                  id="citation-drawer-title"
                  className="font-t02 text-t02 text-on-surface break-words"
                >
                  {citation.documentTitle}
                </h2>
                <p className="font-t05 text-t05 text-on-surface-variant truncate">
                  {citation.badge}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close citation inspector"
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
                  Similarity Score
                </span>
                <span className="font-mono text-mono-md text-on-surface tabular-nums mt-1 block">
                  {similarityPercent}%
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-t05 text-t05 text-on-surface-variant">
                Verbatim Source Excerpt
              </span>
              <div
                className="bg-surface-subtle rounded-md p-15 font-t04 text-t04 text-on-surface leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: sanitizedExcerpt }}
              />
            </div>
          </div>

          <footer className="flex items-center justify-end gap-15 pt-20 border-t border-outline">
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
