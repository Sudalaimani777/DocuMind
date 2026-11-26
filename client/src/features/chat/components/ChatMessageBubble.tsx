import { Fragment, useMemo } from 'react';
import { Bot, User } from 'lucide-react';
import type { ChatRole, CitationDTO } from '@documind/shared';
import { cn } from '../../../core/lib/utils';

interface ChatMessageBubbleProps {
  role: ChatRole;
  content: string;
  citations: CitationDTO[];
  isStreaming?: boolean;
  onSelectCitation: (citation: CitationDTO) => void;
}

type ContentSegment =
  | { type: 'text'; value: string }
  | { type: 'citation'; citation: CitationDTO };

/**
 * Splits assistant response text on `[k]` markers and maps known indices to interactive citations.
 */
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
 * Renders a user or assistant chat bubble, converting inline `[k]` markers into
 * clickable citation badge buttons that open the Citation Inspector Drawer.
 */
export function ChatMessageBubble({
  role,
  content,
  citations,
  isStreaming = false,
  onSelectCitation,
}: ChatMessageBubbleProps) {
  const isUser = role === 'user';

  const { segments, unreferencedCitations } = useMemo(
    () =>
      isUser
        ? { segments: [{ type: 'text' as const, value: content }], unreferencedCitations: [] }
        : parseCitationSegments(content, citations),
    [isUser, content, citations]
  );

  return (
    <div className={cn('flex gap-15', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser ? (
        <div
          className="w-8 h-8 rounded-pill bg-surface-subtle border border-outline flex items-center justify-center shrink-0 mt-0.5 text-secondary"
          aria-hidden="true"
        >
          <Bot className="w-4 h-4" />
        </div>
      ) : null}

      <div
        className={cn(
          'rounded-card px-20 py-15 max-w-[85%] font-t04 text-t04 leading-relaxed',
          isUser
            ? 'bg-secondary text-on-secondary'
            : 'bg-surface border border-outline text-on-surface'
        )}
      >
        <div className="whitespace-pre-wrap break-words">
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
                className="inline-flex items-center mx-1 px-2 py-0.5 rounded-pill border border-outline bg-surface-subtle text-secondary hover:border-outline-focus hover:bg-surface font-mono text-mono-sm transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus align-baseline"
              >
                {citation.badge || `[${citation.index}]`}
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
          <div className="mt-15 pt-15 border-t border-outline flex flex-wrap items-center gap-2">
            <span className="font-t05 text-t05 text-on-surface-variant">Sources:</span>
            {unreferencedCitations.map((citation) => (
              <button
                key={citation.chunkId}
                type="button"
                onClick={() => onSelectCitation(citation)}
                className="inline-flex items-center px-2 py-0.5 rounded-pill border border-outline bg-surface-subtle text-secondary hover:border-outline-focus font-mono text-mono-sm transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
              >
                {citation.badge || `[${citation.index}]`}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {isUser ? (
        <div
          className="w-8 h-8 rounded-pill bg-secondary text-on-secondary flex items-center justify-center shrink-0 mt-0.5"
          aria-hidden="true"
        >
          <User className="w-4 h-4" />
        </div>
      ) : null}
    </div>
  );
}
