import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsertTaskRunningMock = vi.fn();
const upsertTaskSucceededMock = vi.fn();
const upsertTaskFailedMock = vi.fn();
const mapTaskErrorMock = vi.fn();
const writeSystemLogMock = vi.fn();

vi.mock('../server/repositories/articleTasksRepo', () => ({
  upsertTaskRunning: (...args: unknown[]) => upsertTaskRunningMock(...args),
  upsertTaskSucceeded: (...args: unknown[]) => upsertTaskSucceededMock(...args),
  upsertTaskFailed: (...args: unknown[]) => upsertTaskFailedMock(...args),
}));

vi.mock('../server/tasks/errorMapping', () => ({
  mapTaskError: (...args: unknown[]) => mapTaskErrorMock(...args),
}));

vi.mock('../server/logging/systemLogger', () => ({
  writeSystemLog: (...args: unknown[]) => writeSystemLogMock(...args),
}));

describe('articleTaskStatus', () => {
  beforeEach(() => {
    upsertTaskRunningMock.mockReset();
    upsertTaskSucceededMock.mockReset();
    upsertTaskFailedMock.mockReset();
    mapTaskErrorMock.mockReset();
    writeSystemLogMock.mockReset();
  });

  it('writes started and succeeded lifecycle logs when configured', async () => {
    const mod = await import('./articleTaskStatus');
    const result = await mod.runArticleTaskWithStatus({
      pool: {} as never,
      articleId: 'article-1',
      type: 'ai_translate',
      jobId: 'job-1',
      logLifecycle: {
        category: 'ai_translate',
        source: 'worker/index',
        startedMessage: 'AI translation started',
        succeededMessage: 'AI translation succeeded',
        failedMessage: 'AI translation failed',
        context: { articleId: 'article-1', jobId: 'job-1' },
      },
      fn: async () => 'ok',
    });

    expect(result).toBe('ok');
    expect(writeSystemLogMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ message: 'AI translation started' }),
    );
    expect(writeSystemLogMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ message: 'AI translation succeeded' }),
    );
  });

  it('writes failed lifecycle logs when the task throws', async () => {
    mapTaskErrorMock.mockReturnValue({
      errorCode: 'ai_rate_limited',
      errorMessage: '请求太频繁了，请稍后重试',
      rawErrorMessage: '429 rate limit',
    });

    const mod = await import('./articleTaskStatus');
    await expect(
      mod.runArticleTaskWithStatus({
        pool: {} as never,
        articleId: 'article-1',
        type: 'ai_translate',
        jobId: 'job-1',
        logLifecycle: {
          category: 'ai_translate',
          source: 'worker/index',
          startedMessage: 'AI translation started',
          succeededMessage: 'AI translation succeeded',
          failedMessage: 'AI translation failed',
          context: { articleId: 'article-1', jobId: 'job-1' },
        },
        fn: async () => {
          throw new Error('429 rate limit');
        },
      }),
    ).rejects.toThrow('429 rate limit');

    expect(upsertTaskFailedMock).toHaveBeenCalled();
    expect(writeSystemLogMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        level: 'error',
        message: 'AI translation failed',
        details: '429 rate limit',
      }),
    );
  });
});
