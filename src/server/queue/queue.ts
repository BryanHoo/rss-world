import { startBoss } from './boss';

export async function enqueue(
  name: string,
  data: object | null,
  options?: unknown,
): Promise<string> {
  const instance = await startBoss();
  // pg-boss types differ between CJS/ESM builds; keep options loosely typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobId = await instance.send(name, data, options as any);
  if (!jobId) throw new Error('Failed to enqueue job');
  return jobId;
}
