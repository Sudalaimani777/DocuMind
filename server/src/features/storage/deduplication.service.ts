import { and, eq } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import { documents } from '../../core/db/schema.js';
import { ConflictError } from '../../core/errors/AppError.js';
import { computeSha256 } from './hasher.service.js';

export interface ExistingDocumentRef {
  id: string;
  title: string;
  originalFilename: string;
}

export interface IDocumentDeduplicationRepository {
  findByUserAndHash(userId: string, sha256Hash: string): Promise<ExistingDocumentRef | null>;
}

/**
 * Drizzle repository checking per-user SHA-256 document uniqueness.
 */
export class DrizzleDocumentDeduplicationRepository
  implements IDocumentDeduplicationRepository
{
  async findByUserAndHash(
    userId: string,
    sha256Hash: string
  ): Promise<ExistingDocumentRef | null> {
    const rows = await db
      .select({
        id: documents.id,
        title: documents.title,
        originalFilename: documents.originalFilename,
      })
      .from(documents)
      .where(and(eq(documents.userId, userId), eq(documents.sha256Hash, sha256Hash)))
      .limit(1);

    return rows[0] ?? null;
  }
}

/**
 * Enforces cryptographic SHA-256 deduplication scoped to each user's workspace.
 */
export class DeduplicationService {
  constructor(private readonly repository: IDocumentDeduplicationRepository) {}

  async assertUniqueForUser(userId: string, buffer: Buffer): Promise<string> {
    const sha256Hash = computeSha256(buffer);
    const existing = await this.repository.findByUserAndHash(userId, sha256Hash);

    if (existing) {
      throw new ConflictError(
        'This file has already been uploaded. SHA-256 hash match found.',
        {
          existingDocumentId: existing.id,
          title: existing.title,
          originalFilename: existing.originalFilename,
        }
      );
    }

    return sha256Hash;
  }
}
