import { describe, expect, it, vi } from 'vitest';
import { bootstrapQueues } from './bootstrap';

describe('bootstrapQueues', () => {
  it('creates queues and dead-letter queues from contracts', async () => {
    const createQueue = vi.fn().mockResolvedValue(undefined);

    await bootstrapQueues({
      createQueue,
    } as unknown as { createQueue: (name: string, options?: unknown) => Promise<void> });

    expect(createQueue).toHaveBeenCalledWith('article.fetch_fulltext', expect.any(Object));
    expect(createQueue).toHaveBeenCalledWith('dlq.article.fulltext', expect.any(Object));
  });
});
