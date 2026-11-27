import { BookOpenText, ChevronDown, ExternalLink, FileText } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  type ReactNode,
  useCallback,
  useId,
  useState,
} from 'react';
import { cn } from '../../core/lib/utils';

export interface CitationItem {
  id: string;
  index: number;
  title: ReactNode;
  domain?: ReactNode;
  url?: string;
  icon?: ReactNode;
  onClick?: () => void;
}

export interface CitationsProps {
  citations: CitationItem[];
  title?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  idPrefix?: string;
  className?: string;
}

export interface CitationProps {
  citationId: string;
  index: number;
  idPrefix: string;
  label?: string;
  onClick?: () => void;
  className?: string;
}

export interface CitationListProps {
  citations: CitationItem[];
  idPrefix?: string;
  className?: string;
}

export interface CitationStackProps {
  citations: CitationItem[];
  limit?: number;
  className?: string;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const SPRING_LAYOUT = { type: 'spring', stiffness: 420, damping: 34 } as const;
const SPRING_SWAP = { type: 'spring', stiffness: 450, damping: 32 } as const;

function citationTargetId(prefix: string, citationId: string) {
  return `${prefix}-${citationId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

/**
 * Compact numbered inline citation marker.
 */
export function Citation({
  citationId,
  index,
  idPrefix,
  label,
  onClick,
  className,
}: CitationProps) {
  const sharedClass = cn(
    'mx-0.5 inline-flex min-w-4 -translate-y-0.5 items-center justify-center rounded-md bg-surface-accent-subtle px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none text-secondary no-underline outline-none transition-colors duration-instant hover:bg-secondary hover:text-on-secondary focus-visible:ring-2 focus-visible:ring-outline-focus',
    className
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label ?? `View citation ${index}`}
        className={sharedClass}
      >
        {index}
      </button>
    );
  }

  return (
    <a
      href={`#${citationTargetId(idPrefix, citationId)}`}
      aria-label={label ?? `View citation ${index}`}
      className={sharedClass}
    >
      {index}
    </a>
  );
}

export function CitationIcon({
  icon,
  className,
}: {
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-5 shrink-0 place-items-center text-on-surface-variant [&>svg]:size-3.5',
        className
      )}
    >
      {icon ?? <FileText className="size-3.5" />}
    </span>
  );
}

export function CitationStack({
  citations,
  limit = 3,
  className,
}: CitationStackProps) {
  return (
    <span aria-hidden="true" className={cn('flex -space-x-1.5', className)}>
      {citations.slice(0, limit).map((citation) => (
        <CitationIcon
          key={citation.id}
          icon={citation.icon}
          className="size-6 rounded-full bg-surface ring-2 ring-surface"
        />
      ))}
    </span>
  );
}

function CitationRow({
  citation,
  idPrefix,
}: {
  citation: CitationItem;
  idPrefix: string;
}) {
  const content = (
    <>
      <CitationIcon icon={citation.icon} />
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="truncate font-t04 text-t04-medium text-on-surface transition-colors group-hover/citation:text-secondary">
          {citation.title}
        </span>
        {citation.domain ? (
          <span className="min-w-0 truncate font-t05 text-t05 font-normal text-on-surface-variant">
            {citation.domain}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="grid size-5 place-items-center rounded-md bg-surface-subtle font-mono text-[10px] font-semibold tabular-nums text-on-surface">
          {citation.index}
        </span>
        {citation.url ? (
          <ExternalLink className="size-3.5 text-on-surface-variant transition-colors group-hover/citation:text-on-surface" />
        ) : null}
      </span>
    </>
  );

  const rowClass =
    'group/citation flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-surface-subtle/70 focus-visible:ring-2 focus-visible:ring-outline-focus';
  const id = citationTargetId(idPrefix, citation.id);

  if (citation.onClick) {
    return (
      <button type="button" id={id} onClick={citation.onClick} className={rowClass}>
        {content}
      </button>
    );
  }

  return citation.url ? (
    <a
      id={id}
      href={citation.url}
      target="_blank"
      rel="noreferrer noopener"
      className={rowClass}
    >
      {content}
    </a>
  ) : (
    <div id={id} className={rowClass}>
      {content}
    </div>
  );
}

export function CitationList({
  citations,
  idPrefix,
  className,
}: CitationListProps) {
  const reduce = useReducedMotion() ?? false;
  const baseId = useId();
  const resolvedPrefix = idPrefix ?? `citation-list-${baseId.replace(/:/g, '')}`;

  return (
    <div className={cn('grid gap-0.5', className)}>
      <AnimatePresence mode="popLayout">
        {citations.map((citation) => (
          <motion.div
            layout="position"
            key={`${citation.id}-${citation.index}`}
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -3 }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    opacity: { duration: 0.18, ease: EASE_OUT },
                    y: SPRING_LAYOUT,
                    layout: SPRING_LAYOUT,
                  }
            }
          >
            <CitationRow citation={citation} idPrefix={resolvedPrefix} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Collapsible, progressively rendered Sources collection for grounded assistant responses.
 * Adapted from @beui/citations for DocuMind.
 */
export function Citations({
  citations,
  title = 'Sources',
  open,
  defaultOpen = false,
  onOpenChange,
  idPrefix,
  className,
}: CitationsProps) {
  const reduce = useReducedMotion() ?? false;
  const baseId = useId();
  const contentId = `${baseId}-content`;
  const resolvedPrefix = idPrefix ?? `citation-${baseId.replace(/:/g, '')}`;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const currentOpen = open ?? internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange, open]
  );

  return (
    <div className={cn('w-full font-t04 text-t04', className)}>
      <button
        type="button"
        aria-expanded={currentOpen}
        aria-controls={contentId}
        onClick={() => setOpen(!currentOpen)}
        className="group -ml-1 flex min-h-8 items-center gap-2 rounded-md px-1.5 text-left text-on-surface-variant outline-none transition-colors hover:bg-surface-subtle/60 hover:text-on-surface focus-visible:ring-2 focus-visible:ring-outline-focus"
      >
        <BookOpenText className="size-4 text-secondary" aria-hidden="true" />
        <span className="font-t05 text-t05 font-medium">{title}</span>
        <span className="rounded-pill bg-surface-subtle px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-on-surface">
          {citations.length}
        </span>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: currentOpen ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : SPRING_SWAP}
          className="text-on-surface-variant"
        >
          <ChevronDown className="size-3.5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {currentOpen ? (
          <motion.div
            id={contentId}
            initial={reduce ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.18, ease: EASE_OUT }
            }
            className="overflow-hidden"
          >
            <div className="mt-1.5 rounded-md border border-outline bg-surface p-1.5">
              <CitationList citations={citations} idPrefix={resolvedPrefix} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
