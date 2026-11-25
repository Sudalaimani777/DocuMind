import { Redis } from 'ioredis';
import { unifiedConfig } from '../config/unifiedConfig.js';

export interface BullCompatibleRedisOptions {
  maxRetriesPerRequest: null;
  lazyConnect: boolean;
  enableReadyCheck: boolean;
  retryStrategy: (times: number) => number;
}

/**
 * Returns ioredis connection options compatible with BullMQ and auto-reconnection.
 */
export function buildRedisOptions(): BullCompatibleRedisOptions {
  return {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableReadyCheck: true,
    retryStrategy(times: number): number {
      return Math.min(times * 250, 5000);
    },
  };
}

/**
 * Creates a new ioredis client instance pointing to unifiedConfig.redis.url.
 */
export function createRedisClient(): Redis {
  return new Redis(unifiedConfig.redis.url, buildRedisOptions());
}

let sharedRedisClient: Redis | null = null;

/**
 * Returns the shared lazy-connected Redis client singleton.
 */
export function getRedisClient(): Redis {
  if (!sharedRedisClient) {
    sharedRedisClient = createRedisClient();
  }
  return sharedRedisClient;
}

/**
 * Gracefully closes the shared Redis connection if initialized.
 */
export async function closeRedisClient(): Promise<void> {
  if (sharedRedisClient) {
    await sharedRedisClient.quit();
    sharedRedisClient = null;
  }
}
