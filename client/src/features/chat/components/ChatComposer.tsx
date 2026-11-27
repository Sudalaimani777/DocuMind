import { useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { PromptInput, type PromptModel } from '../../../components/ui/prompt-input';

interface ChatComposerProps {
  isStreaming: boolean;
  disabled?: boolean;
  starterPrompts?: readonly string[];
  onSubmit: (query: string) => void;
  onStop: () => void;
}

const CHAT_MODELS: PromptModel[] = [
  {
    value: 'gemini',
    label: 'Gemini',
    icon: <Sparkles className="size-3.5" aria-hidden="true" />,
  },
  {
    value: 'ollama',
    label: 'Ollama (Local)',
    icon: <Bot className="size-3.5" aria-hidden="true" />,
  },
];

/**
 * Auto-growing AI chat composer with model selector and animated Send / Stop controls.
 */
export function ChatComposer({
  isStreaming,
  disabled = false,
  onSubmit,
  onStop,
}: ChatComposerProps) {
  const [selectedModel, setSelectedModel] = useState<string>('gemini');

  return (
    <section aria-label="Chat Input">
      <PromptInput
        id="chat-prompt-input"
        models={CHAT_MODELS}
        model={selectedModel}
        onModelChange={setSelectedModel}
        loading={isStreaming}
        disabled={disabled}
        minRows={2}
        maxRows={6}
        placeholder="Ask a question about your documents..."
        onSubmit={(query) => onSubmit(query)}
        onStop={onStop}
      />
    </section>
  );
}
