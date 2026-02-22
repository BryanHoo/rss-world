import { describe, expect, it } from 'vitest';
import { createMockProvider } from '../mock/mockProvider';

describe('ReaderDataProvider', () => {
  it('returns mutable snapshot and supports markAsRead', () => {
    const provider = createMockProvider();
    const first = provider.getSnapshot().articles[0];
    expect(first.isRead).toBe(false);

    provider.markAsRead(first.id);

    const updated = provider.getSnapshot().articles.find((a) => a.id === first.id);
    expect(updated?.isRead).toBe(true);
  });
});
