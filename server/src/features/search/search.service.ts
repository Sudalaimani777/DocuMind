import type { SearchQueryInput, SearchResponseDTO, SearchResultItemDTO } from '@documind/shared';
import { AppError } from '../../core/errors/AppError.js';
import type { SearchFilters } from './filter.builder.js';
import type { HybridSearchService } from './hybrid.service.js';
import type { LexicalSearchService } from './lexical.service.js';
import type { SemanticSearchService } from './semantic.service.js';

function deduplicateByDocument(
  results: SearchResultItemDTO[],
  scopedDocumentId?: string
): SearchResultItemDTO[] {
  if (scopedDocumentId) {
    return results;
  }
  const seenDocs = new Set<string>();
  return results.filter((item) => {
    if (seenDocs.has(item.documentId)) {
      return false;
    }
    seenDocs.add(item.documentId);
    return true;
  });
}

export interface SearchExecutionOptions {
  minSimilarity?: number;
}

/**
 * Top-level search orchestrator routing keyword, semantic, and hybrid modes.
 */
export class SearchService {
  constructor(
    private readonly lexicalService: LexicalSearchService,
    private readonly semanticService: SemanticSearchService,
    private readonly hybridService: HybridSearchService
  ) {}

  async search(
    userId: string,
    input: SearchQueryInput,
    options?: SearchExecutionOptions
  ): Promise<SearchResponseDTO> {
    const start = performance.now();
    const filters: SearchFilters = {
      format: input.format,
      startDate: input.startDate,
      endDate: input.endDate,
      documentId: input.documentId,
    };

    if (input.mode === 'keyword') {
      const raw = await this.lexicalService.search(userId, input.q, filters, input.limit);
      const results = deduplicateByDocument(raw, input.documentId);
      return {
        query: input.q,
        mode: input.mode,
        activeMode: 'keyword',
        degraded: false,
        totalResults: results.length,
        tookMs: Math.round(performance.now() - start),
        results,
      };
    }

    if (input.mode === 'semantic') {
      try {
        const raw = await this.semanticService.search(
          userId,
          input.q,
          filters,
          input.limit,
          options?.minSimilarity
        );
        const results = deduplicateByDocument(raw, input.documentId);
        return {
          query: input.q,
          mode: input.mode,
          activeMode: 'semantic',
          degraded: false,
          totalResults: results.length,
          tookMs: Math.round(performance.now() - start),
          results,
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'AI provider unavailable';
        throw new AppError(
          `Semantic search is currently unavailable: ${detail}`,
          503,
          'AI_PROVIDER_UNAVAILABLE'
        );
      }
    }

    const hybrid = await this.hybridService.search(
      userId,
      input.q,
      filters,
      input.limit,
      options?.minSimilarity
    );
    const results = deduplicateByDocument(hybrid.results, input.documentId);
    return {
      query: input.q,
      mode: input.mode,
      activeMode: hybrid.activeMode,
      degraded: hybrid.degraded,
      totalResults: results.length,
      tookMs: Math.round(performance.now() - start),
      results,
    };
  }
}
