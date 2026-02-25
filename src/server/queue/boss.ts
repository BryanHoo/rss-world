import { PgBoss } from 'pg-boss';
import { getServerEnv } from '../env';

let boss: PgBoss | null = null;
let startPromise: Promise<PgBoss> | null = null;

export function getBoss(): PgBoss {
  if (boss) return boss;
  const { DATABASE_URL } = getServerEnv();
  boss = new PgBoss({ connectionString: DATABASE_URL });
  return boss;
}

export async function startBoss(): Promise<PgBoss> {
  if (startPromise) return startPromise;
  const instance = getBoss();
  startPromise = instance
    .start()
    .then(() => instance)
    .catch((err) => {
      startPromise = null;
      throw err;
    });
  return startPromise;
}
