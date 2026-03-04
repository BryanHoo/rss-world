import { describe, expect, it, vi } from 'vitest';
import { registerWorkers } from './workerRegistry';

describe('registerWorkers', () => {
  it('registers work handlers with contract worker options', async () => {
    const work = vi.fn().mockResolvedValue('worker-id');

    await registerWorkers(
      {
        work,
      } as unknown as {
        work: (
          name: string,
          options: unknown,
          handler: (jobs: unknown[]) => Promise<void>,
        ) => Promise<string>;
      },
      {
        'article.fetch_fulltext': async () => undefined,
      },
    );

    expect(work).toHaveBeenCalledWith(
      'article.fetch_fulltext',
      expect.objectContaining({ localConcurrency: 4, batchSize: 2 }),
      expect.any(Function),
    );
  });
});
