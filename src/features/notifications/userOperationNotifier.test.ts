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
});
