import { GoogleGenAI } from '@google/genai';
import pLimit from 'p-limit';
import { unifiedConfig } from '../../core/config/unifiedConfig.js';
import {
  assertValid768Embedding,
  STANDARD_EMBEDDING_DIMENSIONS,
  type AIProvider,
} from './ai.provider.js';

export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_CONCURRENCY = 5;

export interface GeminiEmbeddingClient {
  models: {
    embedContent(params: {
      model: string;
      contents: string;
      config?: { outputDimensionality?: number };
    }): Promise<{
      embeddings?: Array<{ values?: number[] }>;
    }>;
  };
}

/**
 * Cloud Google Gemini embedding provider using text-embedding-004 (768 dimensions).
 */
export class GeminiAdapter implements AIProvider {
  readonly providerName = 'gemini' as const;
  readonly dimensions = STANDARD_EMBEDDING_DIMENSIONS;
  private readonly apiKey: string;
  private client: GeminiEmbeddingClient | null;

  constructor(
    apiKey: string = unifiedConfig.ai.geminiApiKey ?? '',
    client?: GeminiEmbeddingClient
  ) {
    this.apiKey = apiKey;
    this.client = client ?? null;
  }

  private getClient(): GeminiEmbeddingClient {
    if (!this.client) {
      if (!this.apiKey) {
        throw new Error('GEMINI_API_KEY is not configured.');
      }
      this.client = new GoogleGenAI({ apiKey: this.apiKey }) as unknown as GeminiEmbeddingClient;
    }
    return this.client;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.getClient().models.embedContent({
      model: GEMINI_EMBEDDING_MODEL,
      contents: text,
      config: { outputDimensionality: STANDARD_EMBEDDING_DIMENSIONS },
    });

    const values = response.embeddings?.[0]?.values;
    return assertValid768Embedding(values, this.providerName);
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const limit = pLimit(EMBEDDING_CONCURRENCY);
    return Promise.all(texts.map((text) => limit(() => this.generateEmbedding(text))));
  }
}
