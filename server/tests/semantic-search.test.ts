import { describe, it, expect, vi } from 'vitest';
import { SemanticSearchService } from '../src/features/search/semantic.service.js';
import type { ISearchRepository, RawSearchRow } from '../src/features/search/search.repository.js';
import type { AIProvider } from '../src/features/ai/ai.provider.js';

function createMockAiProvider(embedding: number[]): AIProvider {
  return {
    providerName: 'gemini',
    dimensions: 768,
    generateEmbedding: vi.fn().mockResolvedValue(embedding),
    generateBatchEmbeddings: vi.fn().mockResolvedValue([embedding]),
  };
}

describe('SemanticSearchService', () => {
  it('vectorizes query via AIProvider and formats semantic results with coordinates', async () => {
    const vector = new Array<number>(768).fill(0.1);
    const aiProvider = createMockAiProvider(vector);

    const mockRow: RawSearchRow = {
      chunkId: 'chunk-2',
      documentId: 'doc-2',
      documentTitle: 'Board Deck',
      originalFilename: 'board_deck.pptx',
      fileType: 'pptx',
      storageUrl: 'https://res.cloudinary.com/demo/raw/upload/deck.pptx',
      chunkIndex: 2,
      content: 'Operating income expanded significantly across EMEA regions.',
      coordinates: { slideNumber: 5 },
      score: 0.91,
    };

    const repo: ISearchRepository = {
      searchLexical: vi.fn().mockResolvedValue([]),
      searchSemantic: vi.fn().mockResolvedValue([mockRow]),
    };

    const service = new SemanticSearchService(repo, aiProvider);
    const results = await service.search('user-1', 'financial revenues', { format: 'pptx' }, 10);

    expect(aiProvider.generateEmbedding).toHaveBeenCalledWith('financial revenues');
    expect(repo.searchSemantic).toHaveBeenCalledWith('user-1', vector, { format: 'pptx' }, 10);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      chunkId: 'chunk-2',
      fileType: 'pptx',
      coordinates: { slideNumber: 5 },
      snippet: 'Operating income expanded significantly across EMEA regions.',
      score: 0.91,
      semanticScore: 0.91,
      matchType: 'semantic',
    });
  });

  it('propagates AIProvider errors when query embedding fails', async () => {
    const aiProvider: AIProvider = {
      providerName: 'ollama',
      dimensions: 768,
      generateEmbedding: vi.fn().mockRejectedValue(new Error('Ollama connection refused')),
      generateBatchEmbeddings: vi.fn(),
    };

    const repo: ISearchRepository = {
      searchLexical: vi.fn(),
      searchSemantic: vi.fn(),
    };

    const service = new SemanticSearchService(repo, aiProvider);
    await expect(service.search('user-1', 'financial revenues', {}, 10)).rejects.toThrow(
      'Ollama connection refused'
    );
    expect(repo.searchSemantic).not.toHaveBeenCalled();
  });
});
