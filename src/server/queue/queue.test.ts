import { beforeEach, describe, expect, it, vi } from 'vitest';

const startBossMock = vi.fn();

vi.mock('./boss', () => ({
  startBoss: (...args: unknown[]) => startBossMock(...args),
}));

describe('queue enqueueWithResult', () => {
  beforeEach(() => {
    startBossMock.mockReset();
    vi.resetModules();
  });

  it('returns throttled_or_duplicate when send resolves null', async () => {
    startBossMock.mockResolvedValue({
      createQueue: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(null),
    });

    const mod = await import('./queue');
    const res = await mod.enqueueWithResult('ai.summarize_article', { articleId: 'a1' }, {});
    expect(res).toEqual({ status: 'throttled_or_duplicate' });
  });

  it('keeps legacy enqueue API returning jobId', async () => {
    startBossMock.mockResolvedValue({
      createQueue: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue('job-1'),
    });

    const mod = await import('./queue');
    await expect(mod.enqueue('feed.fetch', { feedId: 'f1' }, {})).resolves.toBe('job-1');
  });
});
