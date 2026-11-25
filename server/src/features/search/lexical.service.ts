import type { SearchResultItemDTO } from '@documind/shared';
import type { SearchFilters } from './filter.builder.js';
import type { ISearchRepository } from './search.repository.js';
import { sanitizeSnippet } from './snippet.service.js';

/**
 * Executes PostgreSQL full-text lexical search and sanitizes <mark> highlight snippets.
 */
export class LexicalSearchService {
  constructor(private readonly searchRepo: ISearchRepository) {}

  async search(
    userId: string,
    queryText: string,
    filters: SearchFilters,
    limit: number
  ): Promise<SearchResultItemDTO[]> {
    const rows = await this.searchRepo.searchLexical(userId, queryText, filters, limit);

    return rows.map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      documentTitle: row.documentTitle,
      originalFilename: row.originalFilename,
      fileType: row.fileType,
      storageUrl: row.storageUrl,
      chunkIndex: row.chunkIndex,
      content: row.content,
      snippet: sanitizeSnippet(row.snippetHtml ?? row.content),
      coordinates: row.coordinates,
      score: row.score,
      lexicalScore: row.score,
      matchType: 'lexical',
    }));
  }
}
