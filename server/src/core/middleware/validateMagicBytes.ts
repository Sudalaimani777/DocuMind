import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { fileTypeFromBuffer } from 'file-type';
import sanitizeFilename from 'sanitize-filename';
import type { DocumentFormat } from '@documind/shared';
import { BadRequestError } from '../errors/AppError.js';
import { ALLOWED_DOCUMENT_MIME_MAP } from './upload.middleware.js';

export interface ValidatedUploadFile {
  buffer: Buffer;
  size: number;
  sanitizedFilename: string;
  fileType: DocumentFormat;
  detectedMime: string;
}

declare global {
  namespace Express {
    interface Request {
      validatedFiles?: ValidatedUploadFile[];
    }
  }
}

/**
 * Inspects binary magic bytes of uploaded memory buffers using file-type
 * and rejects spoofed or unsupported file signatures.
 */
export async function validateMagicBytes(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      throw new BadRequestError('No files uploaded. Please attach at least one document.');
    }

    const validatedFiles: ValidatedUploadFile[] = [];

    for (const file of files) {
      const detected = await fileTypeFromBuffer(file.buffer);
      const mappedFormat = detected ? ALLOWED_DOCUMENT_MIME_MAP[detected.mime] : undefined;

      if (!detected || !mappedFormat) {
        throw new BadRequestError(
          `Invalid file signature for "${file.originalname}". Binary contents do not match PDF, DOCX, XLSX, or PPTX.`
        );
      }

      const baseName = path.posix.basename(file.originalname.replace(/\\/g, '/'));
      const cleanedName = sanitizeFilename(baseName).replace(/\.{2,}/g, '.').trim();
      const sanitizedFilename = cleanedName.length > 0 ? cleanedName : `document.${mappedFormat}`;

      validatedFiles.push({
        buffer: file.buffer,
        size: file.size,
        sanitizedFilename,
        fileType: mappedFormat,
        detectedMime: detected.mime,
      });
    }

    req.validatedFiles = validatedFiles;
    next();
  } catch (error) {
    next(error);
  }
}
