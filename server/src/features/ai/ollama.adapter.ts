import pLimit from 'p-limit';
import { unifiedConfig } from '../../core/config/unifiedConfig.js';
import {
  assertValid768Embedding,
  STANDARD_EMBEDDING_DIMENSIONS,
  type AIProvider,
} from './ai.provider.js';

export const OLLAMA_EMBEDDING_MODEL = 'nomic-embed-text';
const EMBEDDING_CONCURRENCY = 5;

/**
 * Local Ollama embedding provider using nomic-embed-text (768 dimensions).
 */
export class OllamaAdapter implements AIProvider {
  readonly providerName = 'ollama' as const;
  readonly dimensions = STANDARD_EMBEDDING_DIMENSIONS;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    baseUrl: string = unifiedConfig.ai.ollamaBaseUrl,
    fetchImpl: typeof fetch = fetch
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_EMBEDDING_MODEL,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embeddings request failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as { embedding?: unknown };
    return assertValid768Embedding(payload.embedding, this.providerName);
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const limit = pLimit(EMBEDDING_CONCURRENCY);
    return Promise.all(texts.map((text) => limit(() => this.generateEmbedding(text))));
  }
}
