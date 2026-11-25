export const STANDARD_EMBEDDING_DIMENSIONS = 768 as const;

export type AIProviderName = 'ollama' | 'gemini';

export interface AIProvider {
  readonly providerName: AIProviderName;
  readonly dimensions: typeof STANDARD_EMBEDDING_DIMENSIONS;
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
}

/**
 * Validates that an upstream AI provider returned a finite 768-dimensional embedding vector.
 */
export function assertValid768Embedding(
  values: unknown,
  providerName: AIProviderName
): number[] {
  if (!Array.isArray(values) || values.length !== STANDARD_EMBEDDING_DIMENSIONS) {
    const got = Array.isArray(values) ? values.length : typeof values;
    throw new Error(
      `${providerName} embedding mismatch: expected ${STANDARD_EMBEDDING_DIMENSIONS} dimensions, received ${got}`
    );
  }

  return values.map((v, idx) => {
    const num = Number(v);
    if (!Number.isFinite(num)) {
      throw new Error(`${providerName} embedding contains non-finite value at index ${idx}`);
    }
    return num;
  });
}
