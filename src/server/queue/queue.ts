import 'server-only';
import { startBoss } from './boss';

export async function enqueue(
  name: string,
  data: unknown,
  options?: unknown,
): Promise<string> {
  const instance = await startBoss();
  // pg-boss types differ between CJS/ESM builds; keep options loosely typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return instance.send(name, data, options as any);
}
