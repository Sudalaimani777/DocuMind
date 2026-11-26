import { GoogleGenAI } from '@google/genai';
import { unifiedConfig } from '../../core/config/unifiedConfig.js';
import { AppError } from '../../core/errors/AppError.js';
import type { LLMProvider } from './llm.provider.js';

export interface GeminiLLMClient {
  models: {
    generateContentStream(params: {
      model: string;
      contents: string;
      config?: {
        abortSignal?: AbortSignal;
      };
    }): Promise<AsyncIterable<{ text?: string }>>;
  };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) {
    throw signal.reason;
  }
  const abortError = new Error(typeof signal.reason === 'string' ? signal.reason : 'The operation was aborted');
  abortError.name = 'AbortError';
  throw abortError;
}

/**
 * Cloud Google Gemini streaming LLM provider using @google/genai generateContentStream.
 */
export class GeminiLLMProvider implements LLMProvider {
  readonly providerName = 'gemini' as const;
  private readonly apiKey: string;
  private readonly model: string;
  private client: GeminiLLMClient | null;

  constructor(
    apiKey: string = unifiedConfig.ai.geminiApiKey ?? '',
    model: string = unifiedConfig.ai.geminiLlmModel,
    client?: GeminiLLMClient
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.client = client ?? null;
  }

  private getClient(): GeminiLLMClient {
    if (!this.client) {
      if (!this.apiKey) {
        throw new AppError('GEMINI_API_KEY is not configured.', 500, 'LLM_CONFIG_ERROR');
      }
      this.client = new GoogleGenAI({ apiKey: this.apiKey }) as unknown as GeminiLLMClient;
    }
    return this.client;
  }

  async streamCompletion(
    prompt: string,
    onChunk: (text: string) => void | Promise<void>,
    signal?: AbortSignal
  ): Promise<string> {
    throwIfAborted(signal);

    const stream = await this.getClient().models.generateContentStream({
      model: this.model,
      contents: prompt,
      ...(signal ? { config: { abortSignal: signal } } : {}),
    });

    let fullText = '';
    for await (const chunk of stream) {
      throwIfAborted(signal);
      if (typeof chunk.text === 'string' && chunk.text.length > 0) {
        fullText += chunk.text;
        await onChunk(chunk.text);
      }
    }

    return fullText;
  }
}
