import 'server-only';
import PgBoss from 'pg-boss';
import { getServerEnv } from '../env';

let boss: PgBoss | null = null;
let startPromise: Promise<PgBoss> | null = null;

async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  if (startPromise) return startPromise;

  const { DATABASE_URL } = getServerEnv();
  const instance = new PgBoss({
    connectionString: DATABASE_URL,
  });

  startPromise = instance
    .start()
    .then(() => {
      boss = instance;
      return instance;
    })
    .catch((err) => {
      startPromise = null;
      throw err;
    });

  return startPromise;
}

export async function enqueue(
  name: string,
  data: unknown,
  options?: unknown,
): Promise<string> {
  const instance = await getBoss();
  // pg-boss types differ between CJS/ESM builds; keep options loosely typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return instance.send(name, data, options as any);
}

