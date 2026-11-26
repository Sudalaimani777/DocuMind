import { Fragment, useMemo } from 'react';
import { Info } from 'lucide-react';
import type { CitationDTO } from '@documind/shared';
import { cn } from '../../../core/lib/utils';

interface ChatTurnItemProps {
  userName: string;
  userPrompt: string;
  assistantContent: string | null;
  citations: CitationDTO[];
  timestampLabel?: string;
  isStreaming?: boolean;
  isFirst?: boolean;
  onSelectCitation: (citation: CitationDTO) => void;
}

type ContentSegment =
  | { type: 'text'; value: string }
  | { type: 'citation'; citation: CitationDTO };

const REFUSAL_PREFIX = 'the provided documents do not contain information';

function parseCitationSegments(
  content: string,
  citations: CitationDTO[]
): { segments: ContentSegment[]; unreferencedCitations: CitationDTO[] } {
  const citationMap = new Map<number, CitationDTO>();
  for (const citation of citations) {
    citationMap.set(citation.index, citation);
  }

  const referencedIndices = new Set<number>();
  const segments: ContentSegment[] = [];
  const regex = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        value: content.slice(lastIndex, match.index),
      });
    }

    const citationIndex = Number(match[1]);
    const matchedCitation = citationMap.get(citationIndex);

    if (matchedCitation) {
      referencedIndices.add(citationIndex);
      segments.push({ type: 'citation', citation: matchedCitation });
    } else {
      segments.push({ type: 'text', value: match[0] });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      value: content.slice(lastIndex),
    });
  }

  const unreferencedCitations = citations.filter((c) => !referencedIndices.has(c.index));
  return { segments, unreferencedCitations };
}

/**
 * Editorial Q&A turn matching the Stitch research workspace:
 * left-bordered user question header + grounded synthesis with inline `[k]` links.
 */
export function ChatTurnItem({
  userName,
  userPrompt,
  assistantContent,
  citations,
  timestampLabel = 'Just now',
  isStreaming = false,
  isFirst = false,
  onSelectCitation,
}: ChatTurnItemProps) {
  const safeAssistantText = assistantContent ?? '';
  const isRefusal =
    !isStreaming &&
    safeAssistantText.trim().toLowerCase().startsWith(REFUSAL_PREFIX) &&
    citations.length === 0;

  const { segments, unreferencedCitations } = useMemo(
    () => parseCitationSegments(safeAssistantText, citations),
    [safeAssistantText, citations]
  );

  return (
    <article
      className={cn(
        'flex flex-col gap-20',
        !isFirst && 'pt-20 border-t border-outline'
      )}
    >
      <header
        className={cn(
          'border-l-2 pl-15 py-1 flex flex-col gap-1',
          isRefusal ? 'border-outline' : 'border-primary'
        )}
      >
        <span className="font-t05 text-t05 text-on-surface-variant">
          {userName} · {timestampLabel}
        </span>
        <h2
          className={cn(
            'text-on-surface text-balance',
            isFirst ? 'font-t02 text-t02' : 'font-t03 text-t03'
          )}
        >
          {userPrompt}
        </h2>
      </header>

      {isRefusal ? (
        <div className="bg-surface-subtle rounded-md p-15 flex items-start gap-15 max-w-prose">
          <Info className="w-4 h-4 text-on-surface-variant shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-t04 text-t04 text-on-surface">{safeAssistantText}</p>
        </div>
      ) : assistantContent !== null || isStreaming ? (
        <div className="flex flex-col gap-15 font-t04 text-t04 text-on-surface max-w-prose">
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {segments.map((segment, idx) => {
              if (segment.type === 'text') {
                return <Fragment key={idx}>{segment.value}</Fragment>;
              }

              const { citation } = segment;
              return (
                <button
                  key={`${citation.chunkId}-${idx}`}
                  type="button"
                  onClick={() => onSelectCitation(citation)}
                  aria-label={`Inspect citation ${citation.index}: ${citation.documentTitle}`}
                  className="inline-flex items-center font-mono text-mono-sm text-secondary underline underline-offset-2 hover:text-primary px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
                >
                  [{citation.index}]
                </button>
              );
            })}
            {isStreaming ? (
              <span
                className="inline-block w-2 h-4 ml-1 bg-secondary animate-pulse align-text-bottom"
                aria-label="Streaming response"
              />
            ) : null}
          </div>

          {unreferencedCitations.length > 0 ? (
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <span className="font-t05 text-t05 text-on-surface-variant">Sources:</span>
              {unreferencedCitations.map((citation) => (
                <button
                  key={citation.chunkId}
                  type="button"
                  onClick={() => onSelectCitation(citation)}
                  className="inline-flex items-center font-mono text-mono-sm text-secondary underline underline-offset-2 hover:text-primary px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
                >
                  [{citation.index}] {citation.documentTitle}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
