import { unifiedConfig } from '../../core/config/unifiedConfig.js';
import type { AIProvider, AIProviderName } from './ai.provider.js';
import { OllamaAdapter } from './ollama.adapter.js';
import { GeminiAdapter } from './gemini.adapter.js';

/**
 * Instantiates the configured 768-dimensional AI embedding provider.
 */
export function createAIProvider(
  provider: AIProviderName = unifiedConfig.ai.defaultProvider
): AIProvider {
  if (provider === 'ollama') {
    return new OllamaAdapter();
  }
  return new GeminiAdapter();
}
