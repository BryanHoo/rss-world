import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUserOperationNotifier } from './userOperationNotifier';

describe('userOperationNotifier', () => {
  const toast = {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    toast.success.mockReset();
    toast.info.mockReset();
    toast.error.mockReset();
  });

  it('emits at most one started toast and one terminal toast for the same deferred tracking key', () => {
    const notifier = createUserOperationNotifier({ toast });

    notifier.beginDeferredOperation({
      actionKey: 'feed.refresh',
      trackingKey: 'run-1',
    });
    notifier.beginDeferredOperation({
      actionKey: 'feed.refresh',
      trackingKey: 'run-1',
    });
    notifier.resolveDeferredOperation({
      actionKey: 'feed.refresh',
      trackingKey: 'run-1',
    });
    notifier.resolveDeferredOperation({
      actionKey: 'feed.refresh',
      trackingKey: 'run-1',
    });

    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('suppresses success toasts for low-signal immediate actions', async () => {
    const notifier = createUserOperationNotifier({ toast });

    await notifier.runImmediateOperation({
      actionKey: 'feed.articleListDisplayMode.update',
      execute: async () => 'ok',
    });
    notifier.runImmediateSuccess({ actionKey: 'article.markRead' });
    notifier.runImmediateSuccess({
      actionKey: 'article.toggleStar',
      context: { starred: true },
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('suppresses all toasts for ai summary generation because the reader pane already renders inline state', () => {
    const notifier = createUserOperationNotifier({ toast });

    notifier.beginDeferredOperation({
      actionKey: 'article.aiSummary.generate',
      trackingKey: 'session-1',
    });
    notifier.resolveDeferredOperation({
      actionKey: 'article.aiSummary.generate',
      trackingKey: 'session-1',
    });
    notifier.failDeferredOperation({
      actionKey: 'article.aiSummary.generate',
      trackingKey: 'session-2',
      err: '摘要生成失败',
    });

    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
