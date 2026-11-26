import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';

interface ChatComposerProps {
  isStreaming: boolean;
  disabled?: boolean;
  starterPrompts?: readonly string[];
  onSubmit: (query: string) => void;
  onStop: () => void;
}

const DEFAULT_STARTER_PROMPTS = [
  'Compare obligations and risks across documents',
  'Summarize key financial metrics reported',
  'List all termination and notice clauses',
] as const;

/**
 * Stitch-aligned rounded-card prompt bar with `Ask` action, Stop control,
 * and quiet underlined starter links underneath.
 */
export function ChatComposer({
  isStreaming,
  disabled = false,
  starterPrompts = DEFAULT_STARTER_PROMPTS,
  onSubmit,
  onStop,
}: ChatComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const submitPrompt = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSubmit(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitPrompt();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitPrompt();
    }
  };

  const handleUseStarter = (text: string) => {
    if (isStreaming || disabled) return;
    onSubmit(text);
  };

  return (
    <section aria-label="Chat Input" className="pt-20 border-t border-outline flex flex-col gap-15">
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-outline rounded-card p-2 pl-15 flex items-center gap-15 focus-within:border-outline-focus focus-within:ring-1 focus-within:ring-outline-focus"
      >
        <label htmlFor="chat-prompt-input" className="sr-only">
          Ask a question grounded in your documents
        </label>
        <textarea
          id="chat-prompt-input"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          aria-label="Chat prompt"
          placeholder="Ask a follow-up across your corporate documents..."
          onChange={(e) => {
            setValue(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 resize-none border-0 bg-surface text-on-surface placeholder:text-on-surface-variant font-t04 text-t04 focus:outline-none focus:ring-0 py-2 max-h-[160px]"
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="inline-flex items-center justify-center gap-2 px-20 py-2 min-h-[40px] rounded-md bg-surface-subtle border border-outline text-on-surface font-t04 text-t04-medium hover:bg-surface active:scale-[0.98] transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus shrink-0"
          >
            <Square className="w-4 h-4" aria-hidden="true" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || value.trim().length === 0}
            aria-label="Ask"
            className="inline-flex items-center justify-center gap-2 px-20 py-2 min-h-[40px] rounded-md bg-secondary text-on-secondary font-t04 text-t04-medium hover:bg-primary hover:text-on-primary disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus shrink-0"
          >
            <span>Ask</span>
            <ArrowUp className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-x-15 gap-y-1 font-t05 text-t05 text-on-surface-variant">
        <span>Try:</span>
        {starterPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handleUseStarter(prompt)}
            className="hover:text-on-surface underline underline-offset-2 transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus"
          >
            {prompt}
          </button>
        ))}
      </div>
    </section>
  );
}
