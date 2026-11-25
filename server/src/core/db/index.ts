import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { unifiedConfig } from '../config/unifiedConfig.js';
import * as schema from './schema.js';

export const pool = new Pool({
  connectionString: unifiedConfig.database.url,
});

export const db = drizzle(pool, { schema });

export async function closeDb(): Promise<void> {
  await pool.end();
}
