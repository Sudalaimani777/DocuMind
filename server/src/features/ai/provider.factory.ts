import { unifiedConfig } from '../../core/config/unifiedConfig.js';
import { AppError } from '../../core/errors/AppError.js';
import type { AIProviderName } from './ai.provider.js';
import { GeminiLLMProvider } from './gemini.llm.js';
import type { LLMProvider } from './llm.provider.js';
import { OllamaLLMProvider } from './ollama.llm.js';

/**
 * Creates a streaming LLM provider instance for the specified or default AI provider.
 */
export function createLLMProvider(
  provider: AIProviderName = unifiedConfig.ai.defaultProvider
): LLMProvider {
  if (provider === 'ollama') {
    return new OllamaLLMProvider();
  }
  if (provider === 'gemini') {
    return new GeminiLLMProvider();
  }
  throw new AppError(`Unsupported AI provider: ${String(provider)}`, 400, 'INVALID_AI_PROVIDER');
}
