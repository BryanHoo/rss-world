import { Pool } from 'pg';
import { getServerEnv } from '../env';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const { DATABASE_URL } = getServerEnv();
  pool = new Pool({ connectionString: DATABASE_URL });
  return pool;
}
