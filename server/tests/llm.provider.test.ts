import { describe, it, expect, vi } from 'vitest';
import { unifiedConfig } from '../src/core/config/unifiedConfig.js';
import { AppError } from '../src/core/errors/AppError.js';
import { OllamaLLMProvider } from '../src/features/ai/ollama.llm.js';
import { GeminiLLMProvider, type GeminiLLMClient } from '../src/features/ai/gemini.llm.js';
import { createLLMProvider } from '../src/features/ai/provider.factory.js';

function createNdjsonStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('Pluggable Streaming LLM Engine', () => {
  describe('OllamaLLMProvider', () => {
    it('parses NDJSON chunks, calls onChunk per token, returns concatenated text, and forwards AbortSignal', async () => {
      const controller = new AbortController();
      const receivedTokens: string[] = [];

      const ndjsonChunks = [
        '{"response":"Hello","done":false}\n{"response":" wor',
        'ld","done":false}\n{"response":"!","done":true}\n',
      ];

      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(createNdjsonStream(ndjsonChunks), {
          status: 200,
          headers: { 'Content-Type': 'application/x-ndjson' },
        })
      );

      const provider = new OllamaLLMProvider('http://localhost:11434', 'llama3.1:8b', mockFetch);
      const result = await provider.streamCompletion(
        'Say hello',
        (token) => {
          receivedTokens.push(token);
        },
        controller.signal
      );

      expect(result).toBe('Hello world!');
      expect(receivedTokens).toEqual(['Hello', ' world', '!']);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, init] = mockFetch.mock.calls[0]!;
      expect(url).toBe('http://localhost:11434/api/generate');
      expect(init?.method).toBe('POST');
      expect(init?.signal).toBe(controller.signal);
      expect(JSON.parse(init?.body as string)).toEqual({
        model: 'llama3.1:8b',
        prompt: 'Say hello',
        stream: true,
      });
    });

    it('throws AppError on non-ok HTTP response', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('Model not found', { status: 404 })
      );

      const provider = new OllamaLLMProvider('http://localhost:11434', 'llama3.1:8b', mockFetch);

      await expect(provider.streamCompletion('Say hello', () => {})).rejects.toThrow(AppError);
    });
  });

  describe('GeminiLLMProvider', () => {
    it('iterates generateContentStream, calls onChunk per text chunk, and returns concatenated text', async () => {
      const receivedTokens: string[] = [];
      const generateContentStream = vi.fn(async () => {
        async function* generator() {
          yield { text: 'Hello' };
          yield { text: ' from' };
          yield { text: ' Gemini' };
        }
        return generator();
      });

      const mockClient: GeminiLLMClient = {
        models: { generateContentStream },
      };

      const provider = new GeminiLLMProvider('test-api-key', 'gemini-2.5-flash', mockClient);
      const result = await provider.streamCompletion('Greet me', (token) => {
        receivedTokens.push(token);
      });

      expect(result).toBe('Hello from Gemini');
      expect(receivedTokens).toEqual(['Hello', ' from', ' Gemini']);
      expect(generateContentStream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash',
          contents: 'Greet me',
        })
      );
    });

    it('passes abortSignal in config and respects AbortSignal during streaming', async () => {
      const controller = new AbortController();
      const receivedTokens: string[] = [];
      const generateContentStream = vi.fn(async () => {
        async function* generator() {
          yield { text: 'First' };
          controller.abort(new Error('Client disconnected'));
          yield { text: 'Second' };
        }
        return generator();
      });

      const mockClient: GeminiLLMClient = {
        models: { generateContentStream },
      };

      const provider = new GeminiLLMProvider('test-api-key', 'gemini-2.5-flash', mockClient);

      await expect(
        provider.streamCompletion(
          'Greet me',
          (token) => {
            receivedTokens.push(token);
          },
          controller.signal
        )
      ).rejects.toThrow('Client disconnected');

      expect(receivedTokens).toEqual(['First']);
      expect(generateContentStream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash',
          contents: 'Greet me',
          config: { abortSignal: controller.signal },
        })
      );
    });
  });

  describe('createLLMProvider', () => {
    it('returns OllamaLLMProvider for "ollama" and GeminiLLMProvider for "gemini"', () => {
      const ollama = createLLMProvider('ollama');
      const gemini = createLLMProvider('gemini');

      expect(ollama).toBeInstanceOf(OllamaLLMProvider);
      expect(ollama.providerName).toBe('ollama');
      expect(gemini).toBeInstanceOf(GeminiLLMProvider);
      expect(gemini.providerName).toBe('gemini');
    });

    it('defaults to unifiedConfig.ai.defaultProvider when called with no arguments', () => {
      const defaultProvider = createLLMProvider();
      expect(defaultProvider.providerName).toBe(unifiedConfig.ai.defaultProvider);
    });
  });
});
