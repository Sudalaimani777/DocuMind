import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import type { CitationDTO, CoordinatesDTO } from '@documind/shared';
import { formatCoordinates } from '../../../core/lib/formatCoordinates';
import { cn } from '../../../core/lib/utils';

interface SourceVerificationPanelProps {
  citations: CitationDTO[];
  activeCitation: CitationDTO | null;
  onSelectCitation: (citation: CitationDTO) => void;
}

function formatShortCoordinate(coords: CoordinatesDTO): string {
  if (coords.pageNumber !== undefined) return `p.${coords.pageNumber}`;
  if (coords.rowStart !== undefined && coords.rowEnd !== undefined) {
    return `R${coords.rowStart}–${coords.rowEnd}`;
  }
  if (coords.slideNumber !== undefined) return `s.${coords.slideNumber}`;
  return 'excerpt';
}

/**
 * Sticky right-hand Source Verification Inspector matching the Stitch design:
 * displays the selected verbatim DOMPurify-sanitized excerpt and selectable source list.
 */
export function SourceVerificationPanel({
  citations,
  activeCitation,
  onSelectCitation,
}: SourceVerificationPanelProps) {
  const selected = activeCitation ?? citations[0] ?? null;

  const sanitizedExcerpt = useMemo(() => {
    if (!selected) return '';
    return DOMPurify.sanitize(selected.excerpt, {
      ALLOWED_TAGS: ['mark', 'b', 'strong', 'em', 'i', 'p', 'br'],
      ALLOWED_ATTR: [],
    });
  }, [selected]);

  const sourceCountLabel =
    citations.length === 1 ? '1 source' : `${citations.length} sources`;

  return (
    <aside
      aria-label="Source Verification Inspector"
      className="lg:col-span-5 lg:sticky lg:top-16 bg-surface-subtle/60 border border-outline rounded-md p-4 flex flex-col gap-3.5"
    >
      <header className="flex items-center justify-between gap-3 border-b border-outline pb-2.5">
        <div className="flex flex-col">
          <h2 className="font-t04 text-t04 font-semibold text-on-surface">Sources</h2>
          <span className="font-t05 text-t05 text-on-surface-variant font-normal">
            {citations.length > 0
              ? `Click any reference [1–${citations.length}] to inspect`
              : 'References appear here as answers stream'}
          </span>
        </div>
        <span className="font-t05 text-t05 text-on-surface-variant tabular-nums">{sourceCountLabel}</span>
      </header>

      {selected ? (
        <>
          <div className="bg-surface border border-outline rounded-md p-15 flex flex-col gap-15">
            <div className="flex items-start justify-between gap-15">
              <div className="min-w-0">
                <span className="font-mono text-mono-sm text-secondary block">
                  Citation [{selected.index}]
                </span>
                <h3 className="font-t04 text-t04-medium text-on-surface truncate">
                  {selected.documentTitle}
                </h3>
              </div>
              <span className="font-mono text-mono-sm text-status-ready-text bg-status-ready-bg border border-status-ready-border px-2 py-0.5 rounded-pill shrink-0">
                {selected.similarity.toFixed(2)} match
              </span>
            </div>

            <div className="font-mono text-mono-sm text-on-surface-variant border-y border-outline py-2">
              <span>{formatCoordinates(selected.coordinates)}</span>
            </div>

            <blockquote
              className="border-l-2 border-primary pl-15 font-t04 text-t04 text-on-surface text-pretty leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizedExcerpt }}
            />
          </div>

          <div className="flex flex-col gap-2" role="listbox" aria-label="Cited sources">
            {citations.map((citation) => {
              const isSelected = citation.chunkId === selected.chunkId && citation.index === selected.index;
              return (
                <button
                  key={`${citation.chunkId}-${citation.index}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => onSelectCitation(citation)}
                  className={cn(
                    'w-full text-left px-15 py-2.5 rounded-md bg-surface border flex items-center justify-between gap-15 transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus',
                    isSelected
                      ? 'border-primary shadow-sm'
                      : 'border-outline hover:border-outline-focus'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        'font-mono text-mono-sm shrink-0',
                        isSelected ? 'text-secondary' : 'text-on-surface-variant'
                      )}
                    >
                      [{citation.index}]
                    </span>
                    <span className="font-t05 text-t05 text-on-surface truncate">
                      {citation.documentTitle}
                    </span>
                  </div>
                  <span className="font-mono text-mono-sm text-on-surface-variant shrink-0">
                    {formatShortCoordinate(citation.coordinates)}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="bg-surface border border-outline rounded-md p-4 flex flex-col gap-1 text-center">
          <p className="font-t04 text-t04-medium text-on-surface">No sources yet</p>
          <p className="font-t05 text-t05 text-on-surface-variant font-normal">
            Ask a question to inspect the exact passages used in each answer.
          </p>
        </div>
      )}
    </aside>
  );
}
