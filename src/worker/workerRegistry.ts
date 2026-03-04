import { getWorkerOptions } from '../server/queue/contracts';

export async function registerWorkers(
  boss: {
    work: (
      name: string,
      options: unknown,
      handler: (jobs: unknown[]) => Promise<void>,
    ) => Promise<string>;
  },
  handlers: Record<string, (jobs: unknown[]) => Promise<void>>,
) {
  for (const [name, handler] of Object.entries(handlers)) {
    await boss.work(name, getWorkerOptions(name), handler);
  }
}
