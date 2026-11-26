import { z } from 'zod';

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  organization: z
    .string()
    .trim()
    .min(1, 'Organization is required')
    .max(150, 'Organization must not exceed 150 characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address')
    .max(255, 'Email must not exceed 255 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must not exceed 100 characters'),
});

export const signinSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

export const documentUploadQuerySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title cannot be blank')
    .max(255, 'Title must not exceed 255 characters')
    .optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

export const documentFormatSchema = z.enum(['pdf', 'docx', 'xlsx', 'pptx']);

export const searchModeSchema = z.enum(['hybrid', 'semantic', 'keyword']).default('hybrid');

export const searchQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .min(1, 'Search query is required')
      .max(300, 'Search query must not exceed 300 characters'),
    mode: searchModeSchema,
    format: documentFormatSchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    documentId: z.string().uuid('Invalid documentId UUID').optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
    { message: 'endDate must be on or after startDate', path: ['endDate'] }
  );

export const ragChatRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, 'Query is required')
    .max(2000, 'Query must not exceed 2000 characters'),
  sessionId: z.string().uuid('Invalid sessionId UUID').optional(),
  documentId: z.string().uuid('Invalid documentId UUID').optional(),
});

export const chatSessionsQuerySchema = paginationSchema;

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
export type DocumentUploadQuery = z.infer<typeof documentUploadQuerySchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type UuidParam = z.infer<typeof uuidParamSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type RagChatRequestInput = z.infer<typeof ragChatRequestSchema>;
export type ChatSessionsQueryInput = z.infer<typeof chatSessionsQuerySchema>;
