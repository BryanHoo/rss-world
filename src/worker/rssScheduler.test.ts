import { describe, expect, it } from 'vitest';
import { isFeedDue } from './rssScheduler';

describe('isFeedDue', () => {
  it('returns true when fetchIntervalMinutes is non-positive', () => {
    const now = new Date('2026-03-01T01:00:00.000Z');
    expect(isFeedDue({ lastFetchedAt: null, fetchIntervalMinutes: 0 }, now)).toBe(true);
    expect(isFeedDue({ lastFetchedAt: null, fetchIntervalMinutes: -1 }, now)).toBe(true);
  });

  it('returns true when lastFetchedAt is missing or invalid', () => {
    const now = new Date('2026-03-01T01:00:00.000Z');
    expect(isFeedDue({ lastFetchedAt: null, fetchIntervalMinutes: 60 }, now)).toBe(true);
    expect(isFeedDue({ lastFetchedAt: 'not-a-date', fetchIntervalMinutes: 60 }, now)).toBe(true);
  });

  it('returns false when feed is not due yet', () => {
    const now = new Date('2026-03-01T01:00:00.000Z');
    const lastFetchedAt = new Date('2026-03-01T00:30:00.000Z').toISOString();
    expect(isFeedDue({ lastFetchedAt, fetchIntervalMinutes: 60 }, now)).toBe(false);
  });

  it('returns true when feed is due', () => {
    const now = new Date('2026-03-01T01:00:00.000Z');
    const lastFetchedAt = new Date('2026-03-01T00:00:00.000Z').toISOString();
    expect(isFeedDue({ lastFetchedAt, fetchIntervalMinutes: 60 }, now)).toBe(true);
  });
});

