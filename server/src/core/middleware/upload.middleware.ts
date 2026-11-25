import type { NextFunction, Request, Response } from 'express';
import multer, { MulterError, type FileFilterCallback } from 'multer';
import type { DocumentFormat } from '@documind/shared';
import { BadRequestError } from '../errors/AppError.js';

export const MAX_UPLOAD_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_FILE_COUNT = 5;

export const ALLOWED_DOCUMENT_MIME_MAP: Record<string, DocumentFormat> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
    files: MAX_UPLOAD_FILE_COUNT,
  },
  fileFilter(_req: Request, file: Express.Multer.File, callback: FileFilterCallback) {
    if (!ALLOWED_DOCUMENT_MIME_MAP[file.mimetype]) {
      callback(
        new BadRequestError(
          `Unsupported file type "${file.mimetype}". Allowed formats: PDF, DOCX, XLSX, PPTX.`
        )
      );
      return;
    }
    callback(null, true);
  },
});

const uploadArrayHandler = upload.array('files', MAX_UPLOAD_FILE_COUNT);

/**
 * Multer memory upload middleware enforcing a 25MB limit and MIME whitelist.
 */
export function uploadDocumentsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  uploadArrayHandler(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new BadRequestError('File size exceeds the maximum allowed limit of 25MB.'));
        return;
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        next(
          new BadRequestError(
            `Too many files uploaded. Maximum allowed per request is ${MAX_UPLOAD_FILE_COUNT}.`
          )
        );
        return;
      }
      next(new BadRequestError(`Upload rejected: ${err.message}`));
      return;
    }

    next(err);
  });
}
