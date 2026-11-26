import { and, desc, eq, sql } from 'drizzle-orm';
import type { CoordinatesDTO, DocumentFormat } from '@documind/shared';
import { db } from '../../core/db/index.js';
import { documentChunks, documents } from '../../core/db/schema.js';
import { combineSearchConditions, type SearchFilters } from './filter.builder.js';

export interface RawSearchRow {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  originalFilename: string;
  fileType: DocumentFormat;
  storageUrl: string;
  chunkIndex: number;
  content: string;
  snippetHtml?: string;
  coordinates: CoordinatesDTO;
  score: number;
}

export interface ISearchRepository {
  searchLexical(
    userId: string,
    queryText: string,
    filters: SearchFilters,
    limit: number
  ): Promise<RawSearchRow[]>;
  searchSemantic(
    userId: string,
    queryVector: number[],
    filters: SearchFilters,
    limit: number,
    minSimilarity?: number
  ): Promise<RawSearchRow[]>;
}

const MIN_SEMANTIC_SIMILARITY = 0.65;

/**
 * Drizzle PostgreSQL repository executing user-scoped lexical FTS and pgvector HNSW queries.
 */
export class DrizzleSearchRepository implements ISearchRepository {
  async searchLexical(
    userId: string,
    queryText: string,
    filters: SearchFilters,
    limit: number
  ): Promise<RawSearchRow[]> {
    const tsQuery = sql`websearch_to_tsquery('english', ${queryText})`;
    const tsVector = sql`to_tsvector('english', ${documentChunks.content})`;
    const ilikePattern = `%${queryText}%`;
    const titleOrPrefixMatch = sql`(((${documents.title} ILIKE ${ilikePattern} OR ${documents.originalFilename} ILIKE ${ilikePattern}) AND ${documentChunks.chunkIndex} = 0) OR ${documentChunks.content} ILIKE ${ilikePattern})`;
    const rankExpr = sql<number>`(ts_rank(${tsVector}, ${tsQuery}) + CASE WHEN ${documents.title} ILIKE ${ilikePattern} OR ${documents.originalFilename} ILIKE ${ilikePattern} THEN 0.05 ELSE 0 END + CASE WHEN ${documentChunks.content} ILIKE ${ilikePattern} THEN 0.01 ELSE 0 END)`;
    const headlineExpr = sql<string>`ts_headline('english', ${documentChunks.content}, ${tsQuery}, 'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15')`;

    const baseConditions = combineSearchConditions(userId, filters);
    const ftsOrPrefixMatch = sql`(${tsVector} @@ ${tsQuery} OR ${titleOrPrefixMatch})`;

    const rows = await db
      .select({
        chunkId: documentChunks.id,
        documentId: documents.id,
        documentTitle: documents.title,
        originalFilename: documents.originalFilename,
        fileType: documents.fileType,
        storageUrl: documents.storageUrl,
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        snippetHtml: headlineExpr,
        coordinates: documentChunks.coordinates,
        score: rankExpr,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(and(baseConditions, ftsOrPrefixMatch))
      .orderBy(desc(rankExpr))
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      fileType: row.fileType as DocumentFormat,
      score: Number(row.score),
    }));
  }

  async searchSemantic(
    userId: string,
    queryVector: number[],
    filters: SearchFilters,
    limit: number,
    minSimilarity: number = MIN_SEMANTIC_SIMILARITY
  ): Promise<RawSearchRow[]> {
    const vectorLiteral = `[${queryVector.join(',')}]`;
    const distanceExpr = sql`${documentChunks.embedding} <=> ${vectorLiteral}::vector`;
    const similarityExpr = sql<number>`1 - (${distanceExpr})`;

    const baseConditions = combineSearchConditions(userId, filters);
    const whereClause =
      minSimilarity > 0
        ? and(baseConditions, sql`(1 - (${distanceExpr})) > ${minSimilarity}`)
        : baseConditions;

    const rows = await db
      .select({
        chunkId: documentChunks.id,
        documentId: documents.id,
        documentTitle: documents.title,
        originalFilename: documents.originalFilename,
        fileType: documents.fileType,
        storageUrl: documents.storageUrl,
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        coordinates: documentChunks.coordinates,
        score: similarityExpr,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(whereClause)
      .orderBy(distanceExpr)
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      fileType: row.fileType as DocumentFormat,
      score: Number(row.score),
    }));
  }
}
