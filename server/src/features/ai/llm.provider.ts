import type { AIProviderName } from './ai.provider.js';

/**
 * Pluggable streaming LLM provider interface for RAG generation.
 */
export interface LLMProvider {
  readonly providerName: AIProviderName;
  streamCompletion(
    prompt: string,
    onChunk: (text: string) => void | Promise<void>,
    signal?: AbortSignal
  ): Promise<string>;
}
