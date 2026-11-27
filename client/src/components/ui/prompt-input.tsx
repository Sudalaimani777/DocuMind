import { ArrowUp, Bot, Check, ChevronDown, Square } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '../../core/lib/utils';

export interface PromptModel {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface PromptInputProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'value' | 'defaultValue' | 'onChange' | 'onSubmit' | 'children'
  > {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  models?: PromptModel[];
  model?: string;
  defaultModel?: string;
  onModelChange?: (model: string) => void;
  onSubmit?: (value: string, model?: string) => void | Promise<void>;
  loading?: boolean;
  onStop?: () => void;
  minRows?: number;
  maxRows?: number;
  className?: string;
}

const SPRING_SWAP = { type: 'spring', stiffness: 450, damping: 32 } as const;

/**
 * Auto-growing AI chat composer with model selector and animated send/stop controls.
 * Adapted from @beui/prompt-input for DocuMind's design tokens.
 */
export function PromptInput({
  value,
  defaultValue = '',
  onValueChange,
  models = [],
  model,
  defaultModel,
  onModelChange,
  onSubmit,
  loading = false,
  onStop,
  minRows = 2,
  maxRows = 8,
  className,
  disabled,
  placeholder = 'Ask a question about your documents...',
  'aria-label': ariaLabel = 'Chat prompt',
  onKeyDown,
  ...textareaProps
}: PromptInputProps) {
  const reduce = useReducedMotion() ?? false;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const [internalValue, setInternalValue] = useState(defaultValue);
  const [internalModel, setInternalModel] = useState(defaultModel ?? models[0]?.value);
  const [modelOpen, setModelOpen] = useState(false);

  const currentValue = value ?? internalValue;
  const currentModelValue = model ?? internalModel;
  const currentModel = models.find((option) => option.value === currentModelValue);
  const canSubmit = Boolean(currentValue.trim()) && !disabled && !loading;

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    const measurement = measurementRef.current;
    if (!textarea || !measurement || textarea.value !== currentValue) return;

    const lineHeight = 22;
    const nextHeight = Math.min(
      Math.max(measurement.scrollHeight, minRows * lineHeight),
      maxRows * lineHeight
    );
    const height = `${nextHeight}px`;
    if (textarea.style.height !== height) textarea.style.height = height;
  }, [currentValue, maxRows, minRows]);

  useLayoutEffect(() => {
    resizeTextarea();
  }, [resizeTextarea]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(resizeTextarea);
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [resizeTextarea]);

  useEffect(() => {
    if (!modelOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setModelOpen(false);
      }
    };
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setModelOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [modelOpen]);

  const setValue = (next: string) => {
    if (value === undefined) setInternalValue(next);
    onValueChange?.(next);
  };

  const setModel = (next: string) => {
    if (model === undefined) setInternalModel(next);
    onModelChange?.(next);
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const prompt = currentValue.trim();
    if (!prompt || disabled || loading) return;

    onSubmit?.(prompt, currentModelValue);
    if (value === undefined) setInternalValue('');
    textareaRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event);
    if (
      event.defaultPrevented ||
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    submit();
  };

  return (
    <form
      onSubmit={submit}
      className={cn(
        'relative w-full rounded-md border border-on-surface/70 bg-surface p-2 shadow-sm transition-[border-color,box-shadow] duration-instant ease-instant hover:border-on-surface/60 focus-within:border-outline-focus focus-within:ring-1 focus-within:ring-outline-focus',
        disabled && 'opacity-60',
        className
      )}
    >
      <div
        ref={measurementRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-2 top-0 whitespace-pre-wrap px-2 font-t04 text-t04 leading-[22px] [overflow-wrap:break-word]"
      >
        {`${currentValue}\u200b`}
      </div>

      <textarea
        ref={textareaRef}
        value={currentValue}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={minRows}
        {...textareaProps}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        className="block w-full resize-none overflow-y-auto bg-transparent px-2 pt-1 font-t04 text-t04 leading-[22px] text-on-surface outline-none placeholder:text-on-surface-variant"
      />

      <div className="mt-1.5 flex min-h-8 items-center justify-between gap-2">
        {models.length > 0 ? (
          <div ref={modelMenuRef} className="relative min-w-0">
            <button
              type="button"
              disabled={disabled || loading}
              aria-haspopup="listbox"
              aria-expanded={modelOpen}
              aria-label="Choose model"
              onClick={() => setModelOpen((prev) => !prev)}
              className="inline-flex h-8 max-w-52 items-center gap-1.5 rounded-md px-2 font-t05 text-t05 text-on-surface-variant transition-colors duration-instant ease-instant hover:bg-surface-subtle hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="grid size-3.5 shrink-0 place-items-center text-on-surface-variant">
                {currentModel?.icon ?? <Bot className="size-3.5" aria-hidden="true" />}
              </span>
              <span className="truncate">{currentModel?.label ?? 'Choose model'}</span>
              <ChevronDown
                className={cn(
                  'size-3 shrink-0 transition-transform duration-instant',
                  modelOpen && 'rotate-180'
                )}
                aria-hidden="true"
              />
            </button>

            <AnimatePresence>
              {modelOpen ? (
                <motion.div
                  role="listbox"
                  aria-label="Available models"
                  initial={reduce ? { opacity: 1 } : { opacity: 0, y: 4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: reduce ? 0 : 0.14 }}
                  className="absolute bottom-full left-0 z-30 mb-1.5 w-52 rounded-md border border-outline bg-surface p-1 shadow-sm"
                >
                  {models.map((option) => {
                    const isSelected = option.value === currentModelValue;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={option.disabled}
                        onClick={() => {
                          setModel(option.value);
                          setModelOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left font-t04 text-t04 transition-colors duration-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus disabled:pointer-events-none disabled:opacity-50',
                          isSelected
                            ? 'bg-surface-accent-subtle text-secondary font-medium'
                            : 'text-on-surface hover:bg-surface-subtle'
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="grid size-4 shrink-0 place-items-center text-on-surface-variant">
                            {option.icon ?? <Bot className="size-3.5" aria-hidden="true" />}
                          </span>
                          <span className="truncate">{option.label}</span>
                        </span>
                        {isSelected ? (
                          <Check className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : (
          <span />
        )}

        <button
          type={loading ? 'button' : 'submit'}
          disabled={loading ? !onStop : !canSubmit}
          aria-label={loading ? 'Stop generating' : 'Ask'}
          onClick={loading ? onStop : undefined}
          className={cn(
            'ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus active:scale-95',
            loading
              ? 'border border-outline bg-surface-subtle text-on-surface hover:bg-surface'
              : 'bg-secondary text-on-secondary hover:bg-primary disabled:pointer-events-none disabled:opacity-40'
          )}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={loading ? 'stop' : 'send'}
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 3, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.8 }}
              transition={reduce ? { duration: 0 } : SPRING_SWAP}
              className="grid place-items-center"
            >
              {loading ? (
                <Square className="size-3 fill-current" aria-hidden="true" />
              ) : (
                <ArrowUp className="size-4" aria-hidden="true" />
              )}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </form>
  );
}
