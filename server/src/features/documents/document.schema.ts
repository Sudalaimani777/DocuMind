import { z } from 'zod';
import { paginationSchema } from '@documind/shared';

export const listDocumentsQuerySchema = paginationSchema.extend({
  fileType: z.enum(['pdf', 'docx', 'xlsx', 'pptx']).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
