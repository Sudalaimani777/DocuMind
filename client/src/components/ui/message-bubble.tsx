import { ChevronDown } from 'lucide-react';
import {
  type HTMLMotionProps,
  motion,
  useReducedMotion,
} from 'motion/react';
import {
  type ComponentPropsWithRef,
  cloneElement,
  createContext,
  type ReactElement,
  type ReactNode,
  type Ref,
  useCallback,
  useContext,
  useId,
  useState,
} from 'react';
import { cn } from '../../core/lib/utils';

export type MessageBubbleVariant =
  | 'solid'
  | 'soft'
  | 'tint'
  | 'outline'
  | 'ghost'
  | 'danger';
export type MessageBubbleAlign = 'start' | 'end';

export const messageBubbleMessages = {
  showMore: 'Show more',
  showLess: 'Show less',
};

export type MessageBubbleMessages = typeof messageBubbleMessages;

interface MessageBubbleContextValue {
  align?: MessageBubbleAlign;
  animateIn: boolean;
  variant: MessageBubbleVariant;
  labels?: Partial<MessageBubbleMessages>;
}

const MessageBubbleContext = createContext<MessageBubbleContextValue>({
  animateIn: false,
  variant: 'soft',
});
const MessageBubbleLayoutContext = createContext<() => void>(() => {});

export interface MessageBubbleProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant?: MessageBubbleVariant;
  align?: MessageBubbleAlign;
  animateIn?: boolean;
  labels?: Partial<MessageBubbleMessages>;
  children?: ReactNode;
}

export interface MessageBubbleContentProps extends ComponentPropsWithRef<'div'> {
  render?: ReactElement;
}

export interface MessageBubbleGroupProps extends ComponentPropsWithRef<'div'> {
  spacing?: 'compact' | 'default';
}

export interface MessageBubbleCollapsibleProps extends ComponentPropsWithRef<'div'> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  collapsedLines?: 2 | 3 | 4 | 5 | 6;
  moreLabel?: ReactNode;
  lessLabel?: ReactNode;
  contentClassName?: string;
  triggerClassName?: string;
  children?: ReactNode;
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    }
  };
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const SPRING_LAYOUT = { type: 'spring', stiffness: 420, damping: 34 } as const;
const SPRING_SWAP = { type: 'spring', stiffness: 450, damping: 32 } as const;

const BUBBLE_CONTENT_REVEAL = {
  duration: 0.12,
  ease: EASE_OUT,
  delay: 0.04,
} as const;

const BUBBLE_POP = {
  type: 'spring',
  stiffness: 520,
  damping: 27,
  mass: 0.52,
} as const;

/**
 * Conversational surface with DocuMind tones, alignment, and optional mount animation.
 * Adapted from @beui/message-bubble.
 */
export function MessageBubble({
  variant = 'soft',
  align,
  animateIn = false,
  labels,
  className,
  children,
  initial,
  animate,
  exit,
  transition,
  layout,
  ...props
}: MessageBubbleProps) {
  const reduce = useReducedMotion() ?? false;
  const resolvedAlign = align ?? 'start';

  return (
    <MessageBubbleContext.Provider
      value={{ align: resolvedAlign, animateIn, variant, labels }}
    >
      <motion.div
        data-slot="message-bubble"
        data-align={resolvedAlign}
        data-variant={variant}
        layout={layout}
        initial={initial ?? false}
        animate={animate}
        exit={
          exit ??
          (reduce ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.99 })
        }
        transition={transition ?? (reduce ? { duration: 0.12 } : SPRING_LAYOUT)}
        className={cn(
          'group/bubble flex w-full flex-col',
          resolvedAlign === 'end' ? 'items-end' : 'items-start',
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    </MessageBubbleContext.Provider>
  );
}

function bubbleContentClass(variant: MessageBubbleVariant, interactive: boolean) {
  return cn(
    'relative z-0 min-w-9 max-w-[88%] rounded-xl px-3.5 py-2.5 font-t04 text-t04 leading-6 text-on-surface',
    variant === 'solid' && 'text-surface',
    variant === 'ghost' && 'w-full max-w-none rounded-none px-0 py-0',
    variant === 'danger' && 'text-status-failed-text',
    interactive &&
      'cursor-pointer text-left outline-none transition-[background-color,color,transform] duration-instant hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-outline-focus active:scale-[0.99]'
  );
}

function bubbleSurfaceClass(
  variant: MessageBubbleVariant,
  align: MessageBubbleAlign
) {
  return cn(
    'pointer-events-none absolute inset-0 -z-10 rounded-[inherit]',
    align === 'end' ? 'origin-bottom-right' : 'origin-bottom-left',
    variant === 'solid' && 'bg-on-surface',
    variant === 'soft' && 'bg-surface-subtle/60 border border-outline',
    variant === 'tint' && 'bg-surface-accent-subtle border border-outline',
    variant === 'outline' && 'border border-outline bg-surface',
    variant === 'danger' && 'bg-status-failed-bg border border-status-failed-border'
  );
}

export function MessageBubbleContent({
  render,
  className,
  children,
  ref,
  ...props
}: MessageBubbleContentProps) {
  const reduce = useReducedMotion() ?? false;
  const { align = 'start', animateIn, variant } = useContext(MessageBubbleContext);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const notifyLayout = useCallback(
    () => setLayoutVersion((version) => version + 1),
    []
  );
  const interactive = render?.type === 'button' || render?.type === 'a';
  const classes = cn(bubbleContentClass(variant, interactive), className);

  const composedChildren = (
    <>
      {variant !== 'ghost' ? (
        <motion.span
          aria-hidden="true"
          layout={reduce ? false : 'size'}
          layoutDependency={layoutVersion}
          initial={
            animateIn && !reduce
              ? {
                  opacity: 0,
                  scale: 0.92,
                }
              : false
          }
          animate={{ opacity: 1, scale: 1 }}
          transition={
            reduce
              ? { duration: 0 }
              : {
                  opacity: { duration: 0.12, ease: EASE_OUT },
                  scale: BUBBLE_POP,
                  layout: SPRING_LAYOUT,
                }
          }
          className={bubbleSurfaceClass(variant, align)}
        />
      ) : null}
      <MessageBubbleLayoutContext.Provider value={notifyLayout}>
        <motion.div
          initial={animateIn ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={
            reduce ? { duration: 0.12, ease: EASE_OUT } : BUBBLE_CONTENT_REVEAL
          }
          className="relative"
        >
          {children}
        </motion.div>
      </MessageBubbleLayoutContext.Provider>
    </>
  );

  if (render) {
    const child = render as ReactElement<
      Record<string, unknown> & { className?: string; ref?: Ref<HTMLElement> }
    >;

    return cloneElement(child, {
      ...props,
      ref: mergeRefs(child.props.ref, ref as Ref<HTMLElement> | undefined),
      className: cn(classes, child.props.className),
      children: composedChildren,
      'data-slot': 'message-bubble-content',
    });
  }

  return (
    <div
      ref={ref}
      data-slot="message-bubble-content"
      className={classes}
      {...props}
    >
      {composedChildren}
    </div>
  );
}

export function MessageBubbleGroup({
  spacing = 'compact',
  className,
  ...props
}: MessageBubbleGroupProps) {
  return (
    <div
      data-slot="message-bubble-group"
      className={cn(
        'flex w-full flex-col',
        spacing === 'compact' ? 'gap-1.5' : 'gap-3',
        className
      )}
      {...props}
    />
  );
}

const LINE_CLAMP_CLASS = {
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
} as const;

export function MessageBubbleCollapsible({
  open,
  defaultOpen = false,
  onOpenChange,
  collapsedLines = 4,
  moreLabel,
  lessLabel,
  contentClassName,
  triggerClassName,
  className,
  children,
  ...props
}: MessageBubbleCollapsibleProps) {
  const reduce = useReducedMotion() ?? false;
  const contentId = useId();
  const notifyLayout = useContext(MessageBubbleLayoutContext);
  const ctxLabels = useContext(MessageBubbleContext).labels;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const currentOpen = open ?? internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      notifyLayout();
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [notifyLayout, onOpenChange, open]
  );

  return (
    <div
      data-slot="message-bubble-collapsible"
      data-state={currentOpen ? 'open' : 'closed'}
      className={cn('w-full', className)}
      {...props}
    >
      <div
        id={contentId}
        className={cn(
          'transition-[mask-image] duration-200',
          !currentOpen && LINE_CLAMP_CLASS[collapsedLines],
          !currentOpen &&
            '[mask-image:linear-gradient(to_bottom,#000_68%,transparent_100%)]',
          contentClassName
        )}
      >
        {children}
      </div>
      <button
        type="button"
        aria-expanded={currentOpen}
        aria-controls={contentId}
        onClick={() => setOpen(!currentOpen)}
        className={cn(
          'mt-2 inline-flex h-7 items-center gap-1 rounded-full px-2.5 font-t05 text-t05 font-medium text-on-surface-variant outline-none transition-colors hover:bg-surface-subtle hover:text-on-surface focus-visible:ring-2 focus-visible:ring-outline-focus',
          triggerClassName
        )}
      >
        <span>
          {currentOpen
            ? (lessLabel ?? ctxLabels?.showLess ?? messageBubbleMessages.showLess)
            : (moreLabel ?? ctxLabels?.showMore ?? messageBubbleMessages.showMore)}
        </span>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: currentOpen ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : SPRING_SWAP}
        >
          <ChevronDown className="size-3.5" />
        </motion.span>
      </button>
    </div>
  );
}
