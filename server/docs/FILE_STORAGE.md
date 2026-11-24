# File Storage Architecture & Cloudinary Integration — DocuMind Server

> **Package**: `server/src/features/upload/`  
> **Storage Provider**: Cloudinary (SDK v2)  
> **Resource Type**: `raw` (Binary documents: PDF, DOCX, XLSX, PPTX)

---

## 1. Storage Architecture Overview

DocuMind keeps server instances lightweight and stateless by **never storing permanent binary files on the local disk**:
1. Files arrive in Express via `multer.memoryStorage()`.
2. Binary magic numbers are checked via `file-type`.
3. A `SHA-256` hash is calculated on the in-memory buffer to verify uniqueness.
4. The buffer is streamed directly to Cloudinary using `v2.uploader.upload_stream`.
5. Cloudinary returns a secure URL (`https://res.cloudinary.com/...`) and `public_id`, which are saved in the PostgreSQL `documents` table.

```
┌────────────────────────────────────────────────────────┐
│               1. Express Multer (RAM Buffer)           │
└───────────────────────────┬────────────────────────────┘
                            │ 2. Magic-Bytes & SHA-256 Check
┌───────────────────────────▼────────────────────────────┐
│               3. Cloudinary Upload Stream              │
│   • resource_type: 'raw'                               │
│   • folder: 'documind/documents'                       │
│   • public_id: <uuid>_<clean-filename>                 │
└───────────────────────────┬────────────────────────────┘
                            │ 4. Returns secure URL & public_id
┌───────────────────────────▼────────────────────────────┐
│               5. PostgreSQL Storage                    │
│   • storage_url: https://res.cloudinary.com/...        │
│   • storage_public_id: documind/documents/<uuid>       │
└────────────────────────────────────────────────────────┘
```

---

## 2. Cloudinary Configuration & Client (`server/src/config/cloudinary.ts`)

```typescript
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };
```

---

## 3. Streaming Upload Implementation

Using streams ensures that large files (up to 25MB) do not block or spike Node.js heap memory:

```typescript
import { Readable } from 'stream';
import { cloudinary } from '../../config/cloudinary';

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  bytes: number;
}

export function uploadToCloudinary(
  buffer: Buffer,
  publicId: string
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: 'documind/documents',
        public_id: publicId,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error('Cloudinary upload returned null'));
        }
        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
          bytes: result.bytes,
        });
      }
    );

    // Pipe buffer through readable stream
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}
```

---

## 4. Download & Security Isolation

When downloading original document files:
* Files must **never be served inline as HTML/executable content**.
* Downloads enforce HTTP headers:
  ```http
  Content-Disposition: attachment; filename="sanitized-filename.pdf"
  Content-Type: application/octet-stream
  X-Content-Type-Options: nosniff
  ```
* This guarantees that malicious JavaScript or HTML embedded in documents cannot execute within the user's browser session.

---

## 5. Deletion & Cleanup Lifecycle

When a document is deleted via `DELETE /api/documents/:id`:
```typescript
export async function deleteDocument(documentId: string): Promise<void> {
  // 1. Fetch document record
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  });

  if (!doc) {
    throw new NotFoundError('Document not found');
  }

  // 2. Delete binary asset from Cloudinary
  await cloudinary.uploader.destroy(doc.storagePublicId, {
    resource_type: 'raw',
  });

  // 3. Delete from PostgreSQL (cascades to chunks, vectors, and jobs)
  await db.delete(documents).where(eq(documents.id, documentId));
}
```
* **Atomicity**: The cloud binary asset and database vectors are permanently expunged. Zero orphaned vector embeddings remain in PostgreSQL.
