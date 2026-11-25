import { eq } from 'drizzle-orm';
import type { UserDTO } from '@documind/shared';
import { db } from '../../core/db/index.js';
import { users } from '../../core/db/schema.js';

export interface UserRecord extends UserDTO {
  passwordHash: string;
  updatedAt: string;
}

export interface CreateUserParams {
  name: string;
  organization: string;
  email: string;
  passwordHash: string;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(data: CreateUserParams): Promise<UserRecord>;
}

function mapUserRow(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    name: row.name,
    organization: row.organization,
    email: row.email,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * PostgreSQL Drizzle repository for user persistence.
 */
export class DrizzleUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async create(data: CreateUserParams): Promise<UserRecord> {
    const rows = await db
      .insert(users)
      .values({
        name: data.name,
        organization: data.organization,
        email: data.email.trim().toLowerCase(),
        passwordHash: data.passwordHash,
      })
      .returning();

    return mapUserRow(rows[0]);
  }
}
