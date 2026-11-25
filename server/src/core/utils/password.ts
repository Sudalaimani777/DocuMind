import bcrypt from 'bcrypt';

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Hashes a plain-text password with bcrypt (10 salt rounds).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a stored bcrypt hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
