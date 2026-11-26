import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { unifiedConfig } from '../config/unifiedConfig.js';
import { getRedisClient } from '../redis/index.js';

const skipInTest = () => unifiedConfig.server.nodeEnv === 'test';

function createRedisStore(prefix: string) {
  if (unifiedConfig.server.nodeEnv === 'test') {
    return undefined;
  }
  return new RedisStore({
    sendCommand: (...args: string[]) =>
      getRedisClient().call(args[0], ...args.slice(1)) as Promise<any>,
    prefix,
  });
}

/**
 * General API Rate Limiting
 * Applied globally to all incoming API requests.
 * 100 requests per 15-minute window per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  skip: skipInTest,
  passOnStoreError: true,
  store: createRedisStore('rl:gen:'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP. Please try again later.',
    },
  },
});

/**
 * Authentication Rate Limiter
 * Applied to /api/v1/auth/signin and /api/v1/auth/signup.
 * Blocks brute-force password guessing and credential stuffing.
 * 5 attempts per 15-minute window per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skip: skipInTest,
  passOnStoreError: true,
  store: createRedisStore('rl:auth:'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
    },
  },
});

/**
 * File Upload Rate Limiter
 * Applied to /api/v1/documents/upload.
 * Prevents memory saturation and storage flooding attacks.
 * 10 uploads per 15-minute window per IP.
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skip: skipInTest,
  passOnStoreError: true,
  store: createRedisStore('rl:upload:'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      message: 'Upload limit exceeded. You can upload up to 10 files per 15 minutes.',
    },
  },
});

/**
 * AI Inference Rate Limiter
 * Applied to /api/v1/chat/rag and /api/v1/search.
 * Protects against runaway token billing spikes and LLM API rate limits.
 * 20 queries per 1-minute window per IP/user.
 */
export const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 20,
  skip: skipInTest,
  passOnStoreError: true,
  store: createRedisStore('rl:ai:'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AI_RATE_LIMIT_EXCEEDED',
      message: 'AI query limit reached. Please wait a minute before sending another query.',
    },
  },
});
