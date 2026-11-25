import { customType } from 'drizzle-orm/pg-core';

export const EMBEDDING_DIMENSIONS = 768;

/**
 * Custom Drizzle column type mapping a 768-element number array to PostgreSQL `vector(768)`.
 */
export const vector768 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${EMBEDDING_DIMENSIONS})`;
  },
  toDriver(value: number[]): string {
    if (!Array.isArray(value) || value.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Invalid embedding vector: expected ${EMBEDDING_DIMENSIONS} dimensions, got ${Array.isArray(value) ? value.length : typeof value}`
      );
    }

    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'number' || !Number.isFinite(value[i])) {
        throw new Error(`Invalid embedding vector element at index ${i}`);
      }
    }

    return JSON.stringify(value);
  },
  fromDriver(value: unknown): number[] {
    if (Array.isArray(value)) {
      return value.map((entry) => Number(entry));
    }

    if (typeof value === 'string') {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid vector string returned from database');
      }
      return parsed.map((entry) => Number(entry));
    }

    throw new Error(`Unsupported vector value type from database: ${typeof value}`);
  },
});
