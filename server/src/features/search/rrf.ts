import type { SearchResultItemDTO } from '@documind/shared';

interface RrfAccumulator {
  item: SearchResultItemDTO;
  rrfScore: number;
  hasLexical: boolean;
  hasSemantic: boolean;
  lexicalScore?: number;
  semanticScore?: number;
}

/**
 * Merges and deduplicates lexical and semantic result lists using Reciprocal Rank Fusion (RRF).
 */
export function mergeWithRrf(
  lexical: SearchResultItemDTO[],
  semantic: SearchResultItemDTO[],
  limit: number,
  k = 60
): SearchResultItemDTO[] {
  const map = new Map<string, RrfAccumulator>();

  lexical.forEach((item, index) => {
    const rankScore = 1 / (k + index + 1);
    map.set(item.chunkId, {
      item,
      rrfScore: rankScore,
      hasLexical: true,
      hasSemantic: false,
      lexicalScore: item.lexicalScore ?? item.score,
    });
  });

  semantic.forEach((item, index) => {
    const rankScore = 1 / (k + index + 1);
    const existing = map.get(item.chunkId);
    if (existing) {
      existing.rrfScore += rankScore;
      existing.hasSemantic = true;
      existing.semanticScore = item.semanticScore ?? item.score;
      return;
    }
    map.set(item.chunkId, {
      item,
      rrfScore: rankScore,
      hasLexical: false,
      hasSemantic: true,
      semanticScore: item.semanticScore ?? item.score,
    });
  });

  return Array.from(map.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit)
    .map((entry) => ({
      ...entry.item,
      score: entry.rrfScore,
      lexicalScore: entry.lexicalScore,
      semanticScore: entry.semanticScore,
      matchType:
        entry.hasLexical && entry.hasSemantic
          ? 'hybrid'
          : entry.hasLexical
            ? 'lexical'
            : 'semantic',
    }));
}
