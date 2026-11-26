import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverEnvPath = path.resolve(__dirname, '../../../.env');
const rootEnvPath = path.resolve(__dirname, '../../../../.env');

if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
}
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}
dotenv.config();

const postgresUrlSchema = z
  .string()
  .trim()
  .refine(
    (val) => val.startsWith('postgresql://') || val.startsWith('postgres://'),
    'DATABASE_URL must be a valid PostgreSQL connection string (postgresql:// or postgres://)'
  );

const rawEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    CLIENT_URL: z.string().url().default('http://localhost:5173'),
    DATABASE_URL: postgresUrlSchema.optional(),
    REDIS_URL: z.string().trim().min(1).default('redis://localhost:6379'),
    JWT_SECRET: z.string().min(16).optional(),
    CLOUDINARY_CLOUD_NAME: z.string().default(''),
    CLOUDINARY_API_KEY: z.string().default(''),
    CLOUDINARY_API_SECRET: z.string().default(''),
    OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
    OLLAMA_LLM_MODEL: z.string().trim().min(1).default('llama3.1:8b'),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_LLM_MODEL: z.string().trim().min(1).default('gemini-2.5-flash'),
    DEFAULT_AI_PROVIDER: z.enum(['ollama', 'gemini']).default('gemini'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (!env.DATABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DATABASE_URL'],
          message: 'DATABASE_URL is required in production',
        });
      }
      if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message: 'JWT_SECRET must be at least 32 characters in production',
        });
      }
    }
  });

export interface UnifiedConfig {
  server: {
    nodeEnv: 'development' | 'test' | 'production';
    port: number;
    clientUrl: string;
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  auth: {
    jwtSecret: string;
  };
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };
  ai: {
    defaultProvider: 'ollama' | 'gemini';
    ollamaBaseUrl: string;
    ollamaLlmModel: string;
    geminiApiKey?: string;
    geminiLlmModel: string;
  };
}

/**
 * Validates raw environment variables and returns a typed unified configuration object.
 */
export function parseConfig(rawEnv: Record<string, string | undefined>): UnifiedConfig {
  const parsed = rawEnvSchema.parse(rawEnv);

  return {
    server: {
      nodeEnv: parsed.NODE_ENV,
      port: parsed.PORT,
      clientUrl: parsed.CLIENT_URL,
    },
    database: {
      url: parsed.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/documind',
    },
    redis: {
      url: parsed.REDIS_URL,
    },
    auth: {
      jwtSecret: parsed.JWT_SECRET ?? 'dev-only-jwt-secret-change-in-production',
    },
    cloudinary: {
      cloudName: parsed.CLOUDINARY_CLOUD_NAME,
      apiKey: parsed.CLOUDINARY_API_KEY,
      apiSecret: parsed.CLOUDINARY_API_SECRET,
    },
    ai: {
      defaultProvider: parsed.DEFAULT_AI_PROVIDER,
      ollamaBaseUrl: parsed.OLLAMA_BASE_URL,
      ollamaLlmModel: parsed.OLLAMA_LLM_MODEL,
      geminiApiKey: parsed.GEMINI_API_KEY,
      geminiLlmModel: parsed.GEMINI_LLM_MODEL,
    },
  };
}

export const unifiedConfig: UnifiedConfig = parseConfig(process.env);
