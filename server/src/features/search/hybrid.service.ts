import type { SearchMode, SearchResultItemDTO } from '@documind/shared';
import type { SearchFilters } from './filter.builder.js';
import type { LexicalSearchService } from './lexical.service.js';
import type { SemanticSearchService } from './semantic.service.js';
import { mergeWithRrf } from './rrf.js';

export interface HybridSearchResult {
  results: SearchResultItemDTO[];
  activeMode: SearchMode;
  degraded: boolean;
}

/**
 * Executes lexical and semantic searches concurrently and merges them via RRF,
 * degrading gracefully to lexical results if the AI embedding provider is unavailable.
 */
export class HybridSearchService {
  constructor(
    private readonly lexicalService: LexicalSearchService,
    private readonly semanticService: SemanticSearchService
  ) {}

  async search(
    userId: string,
    queryText: string,
    filters: SearchFilters,
    limit: number
  ): Promise<HybridSearchResult> {
    const candidateLimit = Math.min(limit * 2, 50);

    const [lexicalOutcome, semanticOutcome] = await Promise.allSettled([
      this.lexicalService.search(userId, queryText, filters, candidateLimit),
      this.semanticService.search(userId, queryText, filters, candidateLimit),
    ]);

    if (lexicalOutcome.status === 'rejected') {
      throw lexicalOutcome.reason;
    }

    if (semanticOutcome.status === 'rejected') {
      console.warn(
        '[HybridSearchService] Semantic search failed; degrading to keyword mode:',
        semanticOutcome.reason instanceof Error ? semanticOutcome.reason.message : semanticOutcome.reason
      );
      return {
        results: lexicalOutcome.value.slice(0, limit),
        activeMode: 'keyword',
        degraded: true,
      };
    }

    return {
      results: mergeWithRrf(lexicalOutcome.value, semanticOutcome.value, limit, 60),
      activeMode: 'hybrid',
      degraded: false,
    };
  }
}
