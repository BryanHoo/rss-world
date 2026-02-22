import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from './date';

describe('formatRelativeTime', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('formats recent timestamps in Chinese', () => {
    vi.setSystemTime(new Date('2026-02-22T12:00:00.000Z'));
    expect(formatRelativeTime('2026-02-22T11:59:40.000Z')).toBe('刚刚');
    expect(formatRelativeTime('2026-02-22T11:50:00.000Z')).toBe('10分钟前');
  });
});
