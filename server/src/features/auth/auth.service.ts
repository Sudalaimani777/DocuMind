import type { SignupInput, SigninInput, UserDTO } from '@documind/shared';
import { ConflictError, UnauthorizedError } from '../../core/errors/AppError.js';
import { comparePassword, hashPassword } from '../../core/utils/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../core/utils/jwt.js';
import type { IUserRepository, UserRecord } from './user.repository.js';

// Constant 10-round bcrypt hash used to neutralize timing-based user enumeration attacks
const DUMMY_BCRYPT_HASH = '$2b$10$3euPcmQFCiblsZeEu5s7p.eT7mQ4K1d1/2x1mB2J8XWJzM5F5yBGy';

export interface AuthSessionResult {
  user: UserDTO;
  accessToken: string;
  refreshToken: string;
}

function toUserDTO(record: UserRecord): UserDTO {
  return {
    id: record.id,
    name: record.name,
    organization: record.organization,
    email: record.email,
    createdAt: record.createdAt,
  };
}

function issueSession(record: UserRecord): AuthSessionResult {
  const user = toUserDTO(record);
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id, record.tokenVersion);
  return { user, accessToken, refreshToken };
}

/**
 * Domain service for user registration, credential verification, and session refresh.
 */
export class AuthService {
  constructor(private readonly userRepository: IUserRepository) {}

  async signup(input: SignupInput): Promise<AuthSessionResult> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('An account with this email already exists.');
    }

    const passwordHash = await hashPassword(input.password);
    const created = await this.userRepository.create({
      name: input.name,
      organization: input.organization,
      email: input.email,
      passwordHash,
    });

    return issueSession(created);
  }

  async signin(input: SigninInput): Promise<AuthSessionResult> {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      await comparePassword(input.password, DUMMY_BCRYPT_HASH);
      throw new UnauthorizedError('Invalid email or password.');
    }

    const valid = await comparePassword(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    return issueSession(user);
  }

  async getCurrentUser(userId: string): Promise<UserDTO> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User session is no longer valid.');
    }

    return toUserDTO(user);
  }

  async refreshSession(refreshToken: string): Promise<AuthSessionResult> {
    const payload = verifyRefreshToken(refreshToken);
    const user = await this.userRepository.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedError('Invalid or expired refresh token.');
    }

    return issueSession(user);
  }

  async revokeSession(userId: string): Promise<void> {
    await this.userRepository.incrementTokenVersion(userId);
  }
}
