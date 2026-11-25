import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { ScanSearch } from 'lucide-react';
import type { SearchResultItemDTO } from '@documind/shared';
import { cn } from '../../../core/lib/utils';
import { FormatIcon } from '../../documents/components/FormatBadge';
import { formatCoordinates } from '../utils/formatCoordinates';

interface SearchResultCardProps {
  result: SearchResultItemDTO;
  onInspect: (result: SearchResultItemDTO) => void;
}

/**
 * Computes a 0-100 match confidence percentage from the result score.
 */
export function getMatchConfidencePercent(result: SearchResultItemDTO): number {
  if (result.semanticScore !== undefined) {
    return Math.max(1, Math.min(99, Math.round(result.semanticScore * 100)));
  }
  if (result.lexicalScore !== undefined) {
    return Math.max(50, Math.min(98, Math.round(55 + result.lexicalScore * 43)));
  }
  return Math.max(50, Math.min(99, Math.round(50 + result.score * 1200)));
}

/**
 * Displays a single search hit matching the Stitch Clause & Document Search card:
 * FormatIcon + title, match percentage, coordinate line, DOMPurify-sanitized <mark> snippet,
 * Inspect Source Clause button, and Ask AI About This Document link.
 */
export function SearchResultCard({ result, onInspect }: SearchResultCardProps) {
  const sanitizedSnippet = useMemo(
    () =>
      DOMPurify.sanitize(result.snippet, {
        ALLOWED_TAGS: ['mark'],
        ALLOWED_ATTR: [],
      }),
    [result.snippet]
  );

  const coordinateLabel = formatCoordinates(result.coordinates, result.chunkIndex);
  const confidence = getMatchConfidencePercent(result);

  return (
    <article className="bg-surface border border-outline rounded-card p-20 flex flex-col gap-15 hover:shadow-sm hover:border-outline-focus transition-[border-color,box-shadow] duration-standard ease-standard">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-15">
        <div className="flex items-center gap-2 min-w-0">
          <FormatIcon fileType={result.fileType} />
          <h3 className="font-t03 text-t03 text-on-surface truncate">
            {result.documentTitle || result.originalFilename}
          </h3>
        </div>
        <span
          className={cn(
            'font-mono text-mono-sm tabular-nums shrink-0 self-start sm:self-auto',
            confidence >= 90 ? 'text-status-ready-text' : 'text-on-surface-variant'
          )}
        >
          {confidence}% match
        </span>
      </header>

      <p className="font-t05 text-t05 text-on-surface-variant">
        {coordinateLabel} · {result.originalFilename}
      </p>

      <p
        className="font-t04 text-t04 text-on-surface leading-relaxed [&_mark]:bg-surface-accent-subtle [&_mark]:text-on-surface [&_mark]:font-t04-medium [&_mark]:px-1 [&_mark]:rounded-xs"
        dangerouslySetInnerHTML={{ __html: sanitizedSnippet }}
      />

      <footer className="flex flex-wrap items-center justify-between gap-15 pt-15 border-t border-outline">
        <button
          type="button"
          onClick={() => onInspect(result)}
          className="inline-flex items-center gap-1.5 px-15 py-2 rounded-md bg-surface text-on-surface border border-outline hover:bg-surface-subtle font-t05 text-t05 transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
        >
          <ScanSearch className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Inspect Source Clause</span>
        </button>

        <Link
          to={`/chat/${result.documentId}`}
          className="inline-flex items-center gap-1 font-t04 text-t04-medium text-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus rounded-xs"
        >
          <span>Ask AI About This Document →</span>
        </Link>
      </footer>
    </article>
  );
}
