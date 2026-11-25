import path from 'node:path';
import type { DocumentChunkDTO, DocumentDTO } from '@documind/shared';
import { NotFoundError } from '../../core/errors/AppError.js';
import type { ValidatedUploadFile } from '../../core/middleware/validateMagicBytes.js';
import type { DocumentProcessingQueue } from '../processing/queue.js';
import type { SseService } from '../processing/sse.service.js';
import type { CloudinaryService } from '../storage/cloudinary.service.js';
import type { DeduplicationService } from '../storage/deduplication.service.js';
import type { IDocumentRepository, ListDocumentsFilter } from './document.repository.js';

export interface UploadedDocumentSummary {
  documentId: string;
  jobId: string;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  status: string;
}

export interface PaginatedDocumentsResult {
  items: DocumentDTO[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
}

function deriveTitle(filename: string, customTitle?: string): string {
  if (customTitle && customTitle.trim().length > 0) {
    return customTitle.trim();
  }
  const stem = path.posix.parse(filename).name.replace(/[_-]+/g, ' ').trim();
  return stem.length > 0 ? stem : filename;
}

/**
 * Coordinates document upload security, Cloudinary streaming, BullMQ enqueueing,
 * user-scoped retrieval, and cascading deletion.
 */
export class DocumentService {
  constructor(
    private readonly documentRepository: IDocumentRepository,
    private readonly deduplicationService: DeduplicationService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly processingQueue: DocumentProcessingQueue,
    private readonly sseService: SseService
  ) {}

  async uploadDocuments(
    userId: string,
    files: ValidatedUploadFile[],
    customTitle?: string
  ): Promise<UploadedDocumentSummary[]> {
    const results: UploadedDocumentSummary[] = [];

    for (const file of files) {
      const sha256Hash = await this.deduplicationService.assertUniqueForUser(
        userId,
        file.buffer
      );

      const uploaded = await this.cloudinaryService.uploadRaw(file.buffer);
      let created: { document: DocumentDTO; jobId: string };

      try {
        created = await this.documentRepository.createDocumentWithJob({
          userId,
          title: deriveTitle(file.sanitizedFilename, files.length === 1 ? customTitle : undefined),
          originalFilename: file.sanitizedFilename,
          fileType: file.fileType,
          fileSize: file.size,
          storageUrl: uploaded.secureUrl,
          storagePublicId: uploaded.publicId,
          sha256Hash,
        });
      } catch (dbErr) {
        await this.cloudinaryService.deleteRaw(uploaded.publicId).catch(() => {});
        throw dbErr;
      }

      await this.processingQueue.enqueueDocumentJob({
        jobId: created.jobId,
        documentId: created.document.id,
        userId,
        fileType: file.fileType,
        storageUrl: uploaded.secureUrl,
      });

      this.sseService.emitProgress({
        jobId: created.jobId,
        documentId: created.document.id,
        userId,
        status: 'queued',
        stage: 'QUEUED',
        progress: 0,
      });

      results.push({
        documentId: created.document.id,
        jobId: created.jobId,
        originalFilename: created.document.originalFilename,
        fileType: created.document.fileType,
        fileSize: created.document.fileSize,
        status: created.document.status,
      });
    }

    return results;
  }

  async listDocuments(
    userId: string,
    filter: ListDocumentsFilter
  ): Promise<PaginatedDocumentsResult> {
    const { items, totalItems } = await this.documentRepository.listByUser(userId, filter);
    const totalPages = Math.max(1, Math.ceil(totalItems / filter.limit));

    return {
      items,
      pagination: {
        totalItems,
        totalPages,
        currentPage: filter.page,
        limit: filter.limit,
      },
    };
  }

  async getDocumentById(
    documentId: string,
    userId: string
  ): Promise<{ document: DocumentDTO; chunks: DocumentChunkDTO[] }> {
    const found = await this.documentRepository.findByIdForUser(documentId, userId);
    if (!found) {
      throw new NotFoundError('Document not found.');
    }

    const { storagePublicId: _pubId, sha256Hash: _hash, ...document } = found.document;
    return {
      document,
      chunks: found.chunks,
    };
  }

  async deleteDocument(
    documentId: string,
    userId: string
  ): Promise<{ deletedId: string }> {
    const found = await this.documentRepository.findByIdForUser(documentId, userId);
    if (!found) {
      throw new NotFoundError('Document not found.');
    }

    await this.cloudinaryService.deleteRaw(found.document.storagePublicId);
    await this.documentRepository.deleteByIdForUser(documentId, userId);

    return { deletedId: documentId };
  }
}
