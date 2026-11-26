import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { hashPassword, comparePassword } from '../src/core/utils/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getAuthCookieOptions,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../src/core/utils/jwt.js';
import type {
  IUserRepository,
  UserRecord,
  CreateUserParams,
} from '../src/features/auth/user.repository.js';
import { AuthService } from '../src/features/auth/auth.service.js';
import { createApp } from '../src/app.js';

class InMemoryUserRepository implements IUserRepository {
  private readonly usersById = new Map<string, UserRecord>();

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.trim().toLowerCase();
    for (const user of this.usersById.values()) {
      if (user.email === normalized) {
        return user;
      }
    }
    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.usersById.get(id) ?? null;
  }

  async create(data: CreateUserParams): Promise<UserRecord> {
    const now = new Date().toISOString();
    const record: UserRecord = {
      id: crypto.randomUUID(),
      name: data.name,
      organization: data.organization,
      email: data.email.trim().toLowerCase(),
      passwordHash: data.passwordHash,
      tokenVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.usersById.set(record.id, record);
    return record;
  }

  async incrementTokenVersion(id: string): Promise<number> {
    const user = this.usersById.get(id);
    if (!user) return 1;
    user.tokenVersion += 1;
    user.updatedAt = new Date().toISOString();
    return user.tokenVersion;
  }
}

describe('Milestone 1.3: User Authentication & Private Workspace Isolation', () => {
  describe('Password Utility', () => {
    it('hashes passwords with bcrypt and verifies matching/non-matching inputs', async () => {
      const plain = 'SecurePassword123!';
      const hash = await hashPassword(plain);

      expect(hash).not.toBe(plain);
      expect(hash.startsWith('$2')).toBe(true);
      await expect(comparePassword(plain, hash)).resolves.toBe(true);
      await expect(comparePassword('WrongPassword!', hash)).resolves.toBe(false);
    });
  });

  describe('JWT & Cookie Service', () => {
    it('signs and verifies access and refresh tokens with expected claims', () => {
      const user = {
        id: '1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d',
        email: 'alice@example.com',
        name: 'Alice',
        organization: 'Acme Corp',
      };

      const access = signAccessToken(user);
      const refresh = signRefreshToken(user.id);

      const accessPayload = verifyAccessToken(access);
      expect(accessPayload.sub).toBe(user.id);
      expect(accessPayload.email).toBe(user.email);
      expect(accessPayload.name).toBe(user.name);
      expect(accessPayload.organization).toBe(user.organization);

      const refreshPayload = verifyRefreshToken(refresh);
      expect(refreshPayload.sub).toBe(user.id);
      expect(refreshPayload.tokenVersion).toBe(1);
    });

    it('rejects tampered or malformed JWT tokens', () => {
      expect(() => verifyAccessToken('invalid.jwt.token')).toThrow();
      expect(() => verifyRefreshToken('invalid.jwt.token')).toThrow();
    });

    it('returns httpOnly sameSite=lax cookie options', () => {
      const opts = getAuthCookieOptions(3600_000);
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe('lax');
      expect(opts.path).toBe('/');
      expect(opts.maxAge).toBe(3600_000);
    });
  });

  describe('Auth HTTP Endpoints (/api/v1/auth)', () => {
    let repo: InMemoryUserRepository;
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
      repo = new InMemoryUserRepository();
      const authService = new AuthService(repo);
      app = createApp({ authService });
    });

    it('registers a new user, omits passwordHash, and sets httpOnly auth cookies', async () => {
      const res = await request(app).post('/api/v1/auth/signup').send({
        name: 'Sudalaimani Kannan',
        organization: 'Acme Corp',
        email: 'User@Example.com',
        password: 'SecurePassword123!',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('user@example.com');
      expect(res.body.data.user.name).toBe('Sudalaimani Kannan');
      expect(res.body.data.user.organization).toBe('Acme Corp');
      expect(res.body.data.user.passwordHash).toBeUndefined();

      const setCookies = res.headers['set-cookie'] as unknown as string[];
      expect(Array.isArray(setCookies)).toBe(true);
      expect(setCookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`) && c.includes('HttpOnly'))).toBe(true);
      expect(setCookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`) && c.includes('HttpOnly'))).toBe(true);
    });

    it('returns 400 Bad Request when signup payload fails Zod validation', async () => {
      const res = await request(app).post('/api/v1/auth/signup').send({
        name: 'A',
        organization: '',
        email: 'bad-email',
        password: '123',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects duplicate email registration with 409 Conflict', async () => {
      const payload = {
        name: 'Alice',
        organization: 'Acme Corp',
        email: 'alice@example.com',
        password: 'SecurePassword123!',
      };

      const first = await request(app).post('/api/v1/auth/signup').send(payload);
      expect(first.status).toBe(201);

      const second = await request(app).post('/api/v1/auth/signup').send(payload);
      expect(second.status).toBe(409);
      expect(second.body.success).toBe(false);
      expect(second.body.error.code).toBe('CONFLICT');
    });

    it('signs in with valid credentials and rejects invalid credentials with 401', async () => {
      await request(app).post('/api/v1/auth/signup').send({
        name: 'Bob',
        organization: 'Beta LLC',
        email: 'bob@example.com',
        password: 'ValidPassword123!',
      });

      const badLogin = await request(app).post('/api/v1/auth/signin').send({
        email: 'bob@example.com',
        password: 'WrongPassword!',
      });
      expect(badLogin.status).toBe(401);
      expect(badLogin.body.success).toBe(false);

      const okLogin = await request(app).post('/api/v1/auth/signin').send({
        email: 'bob@example.com',
        password: 'ValidPassword123!',
      });
      expect(okLogin.status).toBe(200);
      expect(okLogin.body.success).toBe(true);
      expect(okLogin.body.data.user.email).toBe('bob@example.com');
      expect(okLogin.body.data.user.passwordHash).toBeUndefined();

      const setCookies = okLogin.headers['set-cookie'] as unknown as string[];
      expect(setCookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`))).toBe(true);
      expect(setCookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`))).toBe(true);
    });

    it('protects /api/v1/auth/me with requireAuth and returns current user when authenticated', async () => {
      const unauth = await request(app).get('/api/v1/auth/me');
      expect(unauth.status).toBe(401);
      expect(unauth.body.success).toBe(false);

      const agent = request.agent(app);
      await agent.post('/api/v1/auth/signup').send({
        name: 'Carol',
        organization: 'Gamma Inc',
        email: 'carol@example.com',
        password: 'CarolPassword123!',
      });

      const meRes = await agent.get('/api/v1/auth/me');
      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.user.email).toBe('carol@example.com');
      expect(meRes.body.data.user.organization).toBe('Gamma Inc');
    });

    it('refreshes access token via /api/v1/auth/refresh and clears cookies on /api/v1/auth/signout', async () => {
      const noRefresh = await request(app).post('/api/v1/auth/refresh');
      expect(noRefresh.status).toBe(401);

      const agent = request.agent(app);
      await agent.post('/api/v1/auth/signup').send({
        name: 'Dave',
        organization: 'Delta Labs',
        email: 'dave@example.com',
        password: 'DavePassword123!',
      });

      const refreshRes = await agent.post('/api/v1/auth/refresh');
      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      const refreshCookies = refreshRes.headers['set-cookie'] as unknown as string[];
      expect(refreshCookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`))).toBe(true);

      const signoutRes = await agent.post('/api/v1/auth/signout');
      expect(signoutRes.status).toBe(200);
      expect(signoutRes.body.success).toBe(true);

      const meAfterSignout = await agent.get('/api/v1/auth/me');
      expect(meAfterSignout.status).toBe(401);
    });

    it('revokes refresh token after signout and rejects subsequent refresh attempts', async () => {
      const agent = request.agent(app);
      const signupRes = await agent.post('/api/v1/auth/signup').send({
        name: 'Eve',
        organization: 'Epsilon Tech',
        email: 'eve@example.com',
        password: 'EvePassword123!',
      });
      expect(signupRes.status).toBe(201);
      const cookies = signupRes.headers['set-cookie'] as unknown as string[];
      const refreshCookie = cookies.find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`));
      expect(refreshCookie).toBeDefined();

      // Sign out to revoke token version
      await agent.post('/api/v1/auth/signout');

      // Attempting to refresh using the old refresh token must be rejected
      const replayRefresh = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [refreshCookie!]);
      expect(replayRefresh.status).toBe(401);
      expect(replayRefresh.body.error.message).toBe('Invalid or expired refresh token.');
    });
  });
});
