import crypto from 'node:crypto';
import { Readable, type Writable } from 'node:stream';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { unifiedConfig } from '../../core/config/unifiedConfig.js';

cloudinary.config({
  cloud_name: unifiedConfig.cloudinary.cloudName,
  api_key: unifiedConfig.cloudinary.apiKey,
  api_secret: unifiedConfig.cloudinary.apiSecret,
  secure: true,
});

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
  bytes: number;
}

export interface CloudinaryUploadOptions {
  resource_type: 'raw';
  folder: string;
  public_id: string;
  overwrite: boolean;
}

export interface CloudinaryUploader {
  upload_stream(
    options: CloudinaryUploadOptions,
    callback: (error?: unknown, result?: Pick<UploadApiResponse, 'public_id' | 'secure_url' | 'bytes'>) => void
  ): Writable;
  destroy(publicId: string, options: { resource_type: 'raw' }): Promise<unknown>;
}

/**
 * Streams raw document buffers directly to Cloudinary without local disk persistence.
 */
export class CloudinaryService {
  constructor(
    private readonly uploader: CloudinaryUploader = cloudinary.uploader as unknown as CloudinaryUploader
  ) {}

  async uploadRaw(buffer: Buffer): Promise<CloudinaryUploadResult> {
    const generatedPublicId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const uploadStream = this.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: 'documind',
          public_id: generatedPublicId,
          overwrite: false,
        },
        (error, result) => {
          if (error || !result) {
            reject(
              error instanceof Error
                ? error
                : new Error('Cloudinary upload failed or returned empty response')
            );
            return;
          }

          resolve({
            publicId: result.public_id,
            secureUrl: result.secure_url,
            bytes: result.bytes,
          });
        }
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }

  async deleteRaw(publicId: string): Promise<void> {
    await this.uploader.destroy(publicId, { resource_type: 'raw' });
  }
}

export const cloudinaryService = new CloudinaryService();
