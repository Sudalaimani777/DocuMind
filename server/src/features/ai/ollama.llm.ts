import { unifiedConfig } from '../../core/config/unifiedConfig.js';
import { AppError } from '../../core/errors/AppError.js';
import type { LLMProvider } from './llm.provider.js';

interface OllamaGenerateChunk {
  response?: string;
  done?: boolean;
  error?: string;
}

/**
 * Local Ollama streaming LLM provider using /api/generate NDJSON streaming.
 */
export class OllamaLLMProvider implements LLMProvider {
  readonly providerName = 'ollama' as const;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    baseUrl: string = unifiedConfig.ai.ollamaBaseUrl,
    model: string = unifiedConfig.ai.ollamaLlmModel,
    fetchImpl: typeof fetch = fetch
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
    this.fetchImpl = fetchImpl;
  }

  async streamCompletion(
    prompt: string,
    onChunk: (text: string) => void | Promise<void>,
    signal?: AbortSignal
  ): Promise<string> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      throw new AppError(
        `Ollama generate request failed with HTTP ${response.status}`,
        502,
        'LLM_PROVIDER_ERROR'
      );
    }

    if (!response.body) {
      throw new AppError('Ollama generate response body is empty', 502, 'LLM_PROVIDER_ERROR');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    const processLine = async (line: string): Promise<void> => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let parsed: OllamaGenerateChunk;
      try {
        parsed = JSON.parse(trimmed) as OllamaGenerateChunk;
      } catch (err) {
        throw new AppError(
          `Failed to parse Ollama NDJSON chunk: ${err instanceof Error ? err.message : String(err)}`,
          502,
          'LLM_STREAM_PARSE_ERROR'
        );
      }

      if (parsed.error) {
        throw new AppError(`Ollama stream error: ${parsed.error}`, 502, 'LLM_PROVIDER_ERROR');
      }

      if (typeof parsed.response === 'string' && parsed.response.length > 0) {
        fullText += parsed.response;
        await onChunk(parsed.response);
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          await processLine(line);
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        await processLine(buffer);
      }
    } catch (err) {
      await reader.cancel().catch(() => {});
      throw err;
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }
}
