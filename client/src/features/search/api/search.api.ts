import type { DocumentFormat, SearchMode, SearchResponseDTO } from '@documind/shared';
import { apiClient } from '../../../core/api/client';

export interface SearchRequestParams {
  q: string;
  mode: SearchMode;
  format?: DocumentFormat;
  startDate?: string;
  endDate?: string;
  documentId?: string;
  limit?: number;
}

interface SearchApiEnvelope {
  success: true;
  data: SearchResponseDTO;
}

/**
 * Executes a multi-mode search query against GET /api/v1/search.
 */
export async function executeSearch(params: SearchRequestParams): Promise<SearchResponseDTO> {
  const cleanParams: Record<string, string | number> = {
    q: params.q.trim(),
    mode: params.mode,
  };

  if (params.format) cleanParams.format = params.format;
  if (params.startDate) cleanParams.startDate = params.startDate;
  if (params.endDate) cleanParams.endDate = params.endDate;
  if (params.documentId) cleanParams.documentId = params.documentId;
  if (params.limit) cleanParams.limit = params.limit;

  const response = await apiClient.get<SearchApiEnvelope>('/search', {
    params: cleanParams,
  });

  return response.data.data;
}
