import { describe, expect, it } from 'vitest';
import { useAppStore } from './appStore';

describe('appStore provider integration', () => {
  it('marks article as read via store action', () => {
    const firstId = useAppStore.getState().articles[0].id;
    useAppStore.getState().markAsRead(firstId);

    const updated = useAppStore.getState().articles.find((a) => a.id === firstId);
    expect(updated?.isRead).toBe(true);
  });
});
