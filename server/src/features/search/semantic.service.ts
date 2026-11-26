import type { SearchResultItemDTO } from '@documind/shared';
import type { AIProvider } from '../ai/ai.provider.js';
import type { SearchFilters } from './filter.builder.js';
import type { ISearchRepository } from './search.repository.js';
import { buildFallbackExcerpt } from './snippet.service.js';

/**
 * Executes 768-dim query vectorization and pgvector cosine nearest-neighbor search.
 */
export class SemanticSearchService {
  constructor(
    private readonly searchRepo: ISearchRepository,
    private readonly aiProvider: AIProvider
  ) {}

  async search(
    userId: string,
    queryText: string,
    filters: SearchFilters,
    limit: number,
    minSimilarity?: number
  ): Promise<SearchResultItemDTO[]> {
    const queryVector = await this.aiProvider.generateEmbedding(queryText);
    const rows =
      minSimilarity !== undefined
        ? await this.searchRepo.searchSemantic(
            userId,
            queryVector,
            filters,
            limit,
            minSimilarity
          )
        : await this.searchRepo.searchSemantic(userId, queryVector, filters, limit);

    return rows.map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      documentTitle: row.documentTitle,
      originalFilename: row.originalFilename,
      fileType: row.fileType,
      storageUrl: row.storageUrl,
      chunkIndex: row.chunkIndex,
      content: row.content,
      snippet: buildFallbackExcerpt(row.content),
      coordinates: row.coordinates,
      score: row.score,
      semanticScore: row.score,
      matchType: 'semantic',
    }));
  }
}
