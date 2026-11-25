import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { executeSearch, type SearchRequestParams } from '../api/search.api';

/**
 * TanStack Query hook for executing cached multi-mode searches.
 */
export function useSearchQuery(params: SearchRequestParams) {
  const trimmedQuery = params.q.trim();

  return useQuery({
    queryKey: [
      'search',
      {
        q: trimmedQuery,
        mode: params.mode,
        format: params.format ?? null,
        startDate: params.startDate ?? null,
        endDate: params.endDate ?? null,
        documentId: params.documentId ?? null,
        limit: params.limit ?? 10,
      },
    ],
    queryFn: () => executeSearch({ ...params, q: trimmedQuery }),
    enabled: trimmedQuery.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
