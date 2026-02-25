import { startBoss } from './boss';
import type { PgBoss } from 'pg-boss';

const ensuredQueues = new Set<string>();
const ensureQueuePromises = new Map<string, Promise<void>>();

async function ensureQueue(instance: PgBoss, name: string): Promise<void> {
  if (ensuredQueues.has(name)) return;

  let promise = ensureQueuePromises.get(name);
  if (!promise) {
    promise = instance
      .createQueue(name)
      .then(() => {
        ensuredQueues.add(name);
      })
      .catch((err) => {
        ensureQueuePromises.delete(name);
        throw err;
      });
    ensureQueuePromises.set(name, promise);
  }

  await promise;
}

export async function enqueue(
  name: string,
  data: object | null,
  options?: unknown,
): Promise<string> {
  const instance = await startBoss();
  await ensureQueue(instance, name);
  // pg-boss types differ between CJS/ESM builds; keep options loosely typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobId = await instance.send(name, data, options as any);
  if (!jobId) throw new Error('Failed to enqueue job');
  return jobId;
}
