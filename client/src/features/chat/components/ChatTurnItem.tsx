import { useMemo } from 'react';
import { Info } from 'lucide-react';
import type { CitationDTO } from '@documind/shared';
import {
  Citations,
  type CitationItem,
} from '../../../components/ui/citations';
import {
  MessageBubble,
  MessageBubbleContent,
  MessageBubbleGroup,
} from '../../../components/ui/message-bubble';
import { formatCoordinates } from '../../../core/lib/formatCoordinates';
import { cn } from '../../../core/lib/utils';
import { FormatIcon } from '../../documents/components/FormatBadge';
import { MarkdownWithCitations } from './MarkdownWithCitations';

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

const REFUSAL_PREFIX = 'the provided documents do not contain information';

/**
 * Conversational Q&A turn using themed MessageBubble surfaces and collapsible Citations list.
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

  const citationItems = useMemo<CitationItem[]>(() => {
    return citations.map((citation) => ({
      id: citation.chunkId,
      index: citation.index,
      title: citation.documentTitle,
      domain: `${formatCoordinates(citation.coordinates)} · ${Math.round(citation.similarity * 100)}% match`,
      icon: <FormatIcon fileType={citation.fileType} />,
      onClick: () => onSelectCitation(citation),
    }));
  }, [citations, onSelectCitation]);

  return (
    <article
      className={cn(
        'flex flex-col gap-3',
        !isFirst && 'pt-4 border-t border-outline'
      )}
    >
      <MessageBubbleGroup spacing="default">
        <div
          data-slot="message"
          data-from="user"
          className="flex flex-col items-end gap-1"
        >
          <span className="font-t05 text-t05 text-on-surface-variant px-1">
            {userName} · {timestampLabel}
          </span>
          <MessageBubble variant="solid" align="end" animateIn>
            <MessageBubbleContent className="text-pretty">
              {userPrompt}
            </MessageBubbleContent>
          </MessageBubble>
        </div>

        {isRefusal ? (
          <div data-slot="message" data-from="assistant">
            <MessageBubble variant="outline" align="start">
              <MessageBubbleContent className="flex items-start gap-2.5 max-w-[90%]">
                <Info
                  className="w-4 h-4 text-on-surface-variant shrink-0 mt-1"
                  aria-hidden="true"
                />
                <p className="font-t04 text-t04 text-on-surface">{safeAssistantText}</p>
              </MessageBubbleContent>
            </MessageBubble>
          </div>
        ) : assistantContent !== null || isStreaming ? (
          <div
            data-slot="message"
            data-from="assistant"
            className="flex flex-col items-start gap-1.5"
          >
            <span className="font-t05 text-t05 text-on-surface-variant px-1">
              DocuMind
            </span>
            <MessageBubble variant="soft" align="start">
              <MessageBubbleContent className="max-w-[92%]">
                <MarkdownWithCitations
                  content={safeAssistantText}
                  citations={citations}
                  isStreaming={isStreaming}
                  onSelectCitation={onSelectCitation}
                />
              </MessageBubbleContent>
            </MessageBubble>

            {citationItems.length > 0 ? (
              <div className="w-full max-w-[92%] px-1">
                <Citations citations={citationItems} />
              </div>
            ) : null}
          </div>
        ) : null}
      </MessageBubbleGroup>
    </article>
  );
}
