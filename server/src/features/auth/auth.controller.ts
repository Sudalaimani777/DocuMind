import type { NextFunction, Request, Response } from 'express';
import type { SigninInput, SignupInput } from '@documind/shared';
import { BaseController } from '../../core/controllers/BaseController.js';
import { UnauthorizedError } from '../../core/errors/AppError.js';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_MS,
  getAuthCookieOptions,
  getClearCookieOptions,
} from '../../core/utils/jwt.js';
import type { AuthService } from './auth.service.js';

/**
 * HTTP controller handling authentication endpoints and HTTP-only cookie emission.
 */
export class AuthController extends BaseController {
  constructor(private readonly authService: AuthService) {
    super();
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie(
      ACCESS_TOKEN_COOKIE,
      accessToken,
      getAuthCookieOptions(ACCESS_TOKEN_MAX_AGE_MS)
    );
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      getAuthCookieOptions(REFRESH_TOKEN_MAX_AGE_MS)
    );
  }

  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as SignupInput;
      const result = await this.authService.signup(input);
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
      this.handleSuccess(res, { user: result.user }, 'Account created successfully.', 201);
    } catch (error) {
      this.handleError(error, next);
    }
  }

  async signin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as SigninInput;
      const result = await this.authService.signin(input);
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
      this.handleSuccess(res, { user: result.user }, 'Signed in successfully.');
    } catch (error) {
      this.handleError(error, next);
    }
  }

  async signout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clearOpts = getClearCookieOptions();
      res.clearCookie(ACCESS_TOKEN_COOKIE, clearOpts);
      res.clearCookie(REFRESH_TOKEN_COOKIE, clearOpts);
      this.handleSuccess(res, null, 'Signed out successfully.');
    } catch (error) {
      this.handleError(error, next);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required. Please sign in.');
      }
      const user = await this.authService.getCurrentUser(req.user.id);
      this.handleSuccess(res, { user });
    } catch (error) {
      this.handleError(error, next);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
      if (!refreshToken) {
        throw new UnauthorizedError('Refresh token is missing.');
      }
      const result = await this.authService.refreshSession(refreshToken);
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
      this.handleSuccess(res, { user: result.user }, 'Session refreshed.');
    } catch (error) {
      this.handleError(error, next);
    }
  }
}
