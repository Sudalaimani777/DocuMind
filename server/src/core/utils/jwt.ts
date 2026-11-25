import jwt from 'jsonwebtoken';
import type { CookieOptions } from 'express';
import { unifiedConfig } from '../config/unifiedConfig.js';
import { UnauthorizedError } from '../errors/AppError.js';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const ACCESS_TOKEN_MAX_AGE_MS = 60 * 60 * 1000;
export const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  organization: string;
  tokenType: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion: number;
  tokenType: 'refresh';
}

export interface TokenUserClaims {
  id: string;
  email: string;
  name: string;
  organization: string;
}

/**
 * Issues a signed 1-hour JWT access token.
 */
export function signAccessToken(user: TokenUserClaims): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    organization: user.organization,
    tokenType: 'access',
  };

  return jwt.sign(payload, unifiedConfig.auth.jwtSecret, { expiresIn: '1h' });
}

/**
 * Issues a signed 7-day JWT refresh token.
 */
export function signRefreshToken(userId: string, tokenVersion = 1): string {
  const payload: RefreshTokenPayload = {
    sub: userId,
    tokenVersion,
    tokenType: 'refresh',
  };

  return jwt.sign(payload, unifiedConfig.auth.jwtSecret, { expiresIn: '7d' });
}

/**
 * Verifies an access token and returns its decoded claims.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, unifiedConfig.auth.jwtSecret) as Partial<AccessTokenPayload>;
    if (!decoded.sub || !decoded.email || decoded.tokenType !== 'access') {
      throw new UnauthorizedError('Invalid or expired authentication session.');
    }
    return decoded as AccessTokenPayload;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    throw new UnauthorizedError('Invalid or expired authentication session.');
  }
}

/**
 * Verifies a refresh token and returns its decoded claims.
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, unifiedConfig.auth.jwtSecret) as Partial<RefreshTokenPayload>;
    if (!decoded.sub || typeof decoded.tokenVersion !== 'number' || decoded.tokenType !== 'refresh') {
      throw new UnauthorizedError('Invalid or expired refresh token.');
    }
    return decoded as RefreshTokenPayload;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    throw new UnauthorizedError('Invalid or expired refresh token.');
  }
}

/**
 * Builds standard httpOnly cookie options for auth tokens.
 */
export function getAuthCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: unifiedConfig.server.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

/**
 * Builds cookie clearing options matching auth cookie attributes.
 */
export function getClearCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: unifiedConfig.server.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  };
}
