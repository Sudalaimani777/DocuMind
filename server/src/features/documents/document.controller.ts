import type { NextFunction, Request, Response } from 'express';
import type { DocumentUploadQuery } from '@documind/shared';
import { BaseController } from '../../core/controllers/BaseController.js';
import { BadRequestError, UnauthorizedError } from '../../core/errors/AppError.js';
import type { ListDocumentsQuery } from './document.schema.js';
import type { DocumentService } from './document.service.js';

/**
 * HTTP controller for user-scoped document upload, listing, inspection, and deletion.
 */
export class DocumentController extends BaseController {
  constructor(private readonly documentService: DocumentService) {
    super();
  }

  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const files = req.validatedFiles;
      if (!files || files.length === 0) {
        throw new BadRequestError('No validated files found in upload request.');
      }

      const query = res.locals.validated?.query as DocumentUploadQuery | undefined;
      const bodyTitle =
        typeof req.body?.title === 'string' && req.body.title.trim().length > 0
          ? req.body.title.trim()
          : undefined;
      const title = query?.title ?? bodyTitle;

      const items = await this.documentService.uploadDocuments(req.user.id, files, title);
      const data =
        items.length === 1
          ? { items, ...items[0] }
          : { items };

      this.handleSuccess(
        res,
        data,
        `${items.length} file(s) accepted and queued for background ingestion.`,
        202
      );
    } catch (error) {
      this.handleError(error, next);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const query = (res.locals.validated?.query as ListDocumentsQuery | undefined) ?? {
        page: 1,
        limit: 20,
      };
      const result = await this.documentService.listDocuments(req.user.id, query);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, next);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const params = res.locals.validated?.params as { id: string } | undefined;
      const documentId = params?.id ?? String(req.params.id);
      const result = await this.documentService.getDocumentById(documentId, req.user.id);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, next);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const params = res.locals.validated?.params as { id: string } | undefined;
      const documentId = params?.id ?? String(req.params.id);
      const result = await this.documentService.deleteDocument(documentId, req.user.id);
      this.handleSuccess(
        res,
        result,
        'Document and all associated vector embeddings successfully deleted.'
      );
    } catch (error) {
      this.handleError(error, next);
    }
  }
}
