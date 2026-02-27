import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateYMD, formatRelativeTime, getArticleSectionHeading, getLocalDayKey } from './date';

describe('formatRelativeTime', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('formats recent timestamps in Chinese', () => {
    vi.setSystemTime(new Date('2026-02-22T12:00:00.000Z'));
    expect(formatRelativeTime('2026-02-22T11:59:40.000Z')).toBe('刚刚');
    expect(formatRelativeTime('2026-02-22T11:50:00.000Z')).toBe('10分钟前');
  });
});

describe('article section date helpers', () => {
  it('formats Chinese calendar labels and day keys', () => {
    const date = new Date(2026, 1, 22, 12, 0, 0);
    expect(getLocalDayKey(date)).toBe('2026-02-22');
    expect(formatDateYMD(date)).toBe('2026年02月22日');
  });

  it('creates headings for today and yesterday', () => {
    const now = new Date(2026, 1, 22, 12, 0, 0);

    const today = new Date(2026, 1, 22, 8, 30, 0);
    expect(getArticleSectionHeading(today, now)).toBe('今天');

    const yesterday = new Date(2026, 1, 21, 22, 0, 0);
    expect(getArticleSectionHeading(yesterday, now)).toBe('昨天');
  });

  it('uses YYYY年MM月DD日 heading for earlier dates', () => {
    const now = new Date(2026, 1, 22, 12, 0, 0);
    const earlier = new Date(2026, 1, 20, 9, 0, 0);
    expect(getArticleSectionHeading(earlier, now)).toBe('2026年02月20日');
  });
});
