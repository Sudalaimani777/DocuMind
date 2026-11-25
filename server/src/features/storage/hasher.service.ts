import crypto from 'node:crypto';

/**
 * Computes a deterministic 64-character lowercase SHA-256 hex digest from a binary buffer.
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
