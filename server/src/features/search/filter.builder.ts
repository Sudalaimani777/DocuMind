import { and, eq, gte, lte, type SQL } from 'drizzle-orm';
import type { DocumentFormat } from '@documind/shared';
import { documents } from '../../core/db/schema.js';

export interface SearchFilters {
  format?: DocumentFormat;
  startDate?: Date;
  endDate?: Date;
  documentId?: string;
}

/**
 * Builds mandatory user-isolation and optional faceted filter SQL predicates.
 */
export function buildSearchConditions(userId: string, filters: SearchFilters): SQL[] {
  const conditions: SQL[] = [
    eq(documents.userId, userId),
    eq(documents.status, 'completed'),
  ];

  if (filters.format) {
    conditions.push(eq(documents.fileType, filters.format));
  }
  if (filters.startDate) {
    conditions.push(gte(documents.createdAt, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(documents.createdAt, filters.endDate));
  }
  if (filters.documentId) {
    conditions.push(eq(documents.id, filters.documentId));
  }

  return conditions;
}

/**
 * Combines mandatory and faceted search predicates into a single Drizzle AND expression.
 */
export function combineSearchConditions(userId: string, filters: SearchFilters): SQL | undefined {
  return and(...buildSearchConditions(userId, filters));
}
