import { Fragment, type ReactNode } from 'react';
import type { CitationDTO } from '@documind/shared';
import { InfinityLoader } from '../../../components/ui/loader-13';

interface MarkdownWithCitationsProps {
  content: string;
  citations: CitationDTO[];
  isStreaming?: boolean;
  onSelectCitation: (citation: CitationDTO) => void;
}

const CITATION_GROUP_PATTERN = /\[(\d+(?:\s*,\s*\d+)*)\]/;
const INLINE_TOKEN_PATTERN = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[(?:\d+(?:\s*,\s*\d+)*)\])/;

/**
 * Collects all citation indices referenced in `[k]` or `[k, m]` markers.
 */
export function getReferencedCitationIndices(content: string): Set<number> {
  const referenced = new Set<number>();
  const regex = new RegExp(CITATION_GROUP_PATTERN.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    for (const part of match[1].split(',')) {
      const idx = Number(part.trim());
      if (!Number.isNaN(idx)) referenced.add(idx);
    }
  }
  return referenced;
}

function renderInline(
  text: string,
  citationMap: Map<number, CitationDTO>,
  onSelectCitation: (citation: CitationDTO) => void,
  keyPrefix: string
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = new RegExp(INLINE_TOKEN_PATTERN.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const tokenKey = `${keyPrefix}-${match.index}`;

    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={tokenKey}
          className="px-1 py-0.5 rounded-xs bg-surface-subtle border border-outline font-mono text-mono-sm text-on-surface"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={tokenKey} className="font-semibold text-on-surface">
          {renderInline(token.slice(2, -2), citationMap, onSelectCitation, `${tokenKey}-b`)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={tokenKey}>
          {renderInline(token.slice(1, -1), citationMap, onSelectCitation, `${tokenKey}-i`)}
        </em>
      );
    } else if (token.startsWith('[') && token.endsWith(']')) {
      const indices = token
        .slice(1, -1)
        .split(',')
        .map((p) => Number(p.trim()));
      const matched = indices
        .map((idx) => citationMap.get(idx))
        .filter((c): c is CitationDTO => Boolean(c));

      if (matched.length > 0) {
        nodes.push(
          <span key={tokenKey} className="inline-flex items-center gap-0.5 mx-0.5 align-baseline">
            {matched.map((citation, cIdx) => (
              <button
                key={`${tokenKey}-c-${citation.chunkId}-${cIdx}`}
                type="button"
                onClick={() => onSelectCitation(citation)}
                aria-label={`Inspect citation ${citation.index}: ${citation.documentTitle}`}
                className="inline-flex items-center font-mono text-mono-sm text-secondary underline underline-offset-2 hover:text-primary px-0.5 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
              >
                [{citation.index}]
              </button>
            ))}
          </span>
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(token);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Renders assistant Markdown responses (headings, lists, code, bold/italic)
 * with interactive `[k]` and `[k, m]` citation links as safe React elements.
 */
export function MarkdownWithCitations({
  content,
  citations,
  isStreaming = false,
  onSelectCitation,
}: MarkdownWithCitationsProps) {
  const citationMap = new Map<number, CitationDTO>();
  for (const c of citations) {
    citationMap.set(c.index, c);
  }

  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre
          key={`code-${i}`}
          className="bg-surface-subtle border border-outline rounded-md p-3 overflow-x-auto font-mono text-mono-sm text-on-surface my-2"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const cls =
        level === 1
          ? 'font-t02 text-t02 text-on-surface mt-3 mb-1'
          : level === 2
            ? 'font-t03 text-t03 text-on-surface mt-2.5 mb-1'
            : 'font-t04 text-t04 font-semibold text-on-surface mt-2 mb-0.5';
      blocks.push(
        <p key={`h-${i}`} className={cls}>
          {renderInline(text, citationMap, onSelectCitation, `h-${i}`)}
        </p>
      );
      i += 1;
      continue;
    }

    // Unordered list (* or -)
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      const startIdx = i;
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${startIdx}`} className="list-disc pl-5 space-y-1 my-1.5">
          {items.map((item, itemIdx) => (
            <li key={`li-${startIdx}-${itemIdx}`} className="leading-relaxed">
              {renderInline(item, citationMap, onSelectCitation, `ul-${startIdx}-${itemIdx}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list (1. 2. ...)
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      const startIdx = i;
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${startIdx}`} className="list-decimal pl-5 space-y-1 my-1.5">
          {items.map((item, itemIdx) => (
            <li key={`oli-${startIdx}-${itemIdx}`} className="leading-relaxed">
              {renderInline(item, citationMap, onSelectCitation, `ol-${startIdx}-${itemIdx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph (group consecutive plain lines)
    const paraLines: string[] = [];
    const startIdx = i;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !/^(#{1,3})\s+/.test(lines[i].trim()) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={`p-${startIdx}`} className="leading-relaxed">
        {paraLines.map((pLine, pIdx) => (
          <Fragment key={`pl-${startIdx}-${pIdx}`}>
            {pIdx > 0 ? <br /> : null}
            {renderInline(pLine, citationMap, onSelectCitation, `p-${startIdx}-${pIdx}`)}
          </Fragment>
        ))}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 break-words">
      {blocks}
      {isStreaming ? (
        <InfinityLoader
          size={blocks.length === 0 ? 24 : 18}
          className="justify-start"
          aria-label="Streaming response"
        />
      ) : null}
    </div>
  );
}
