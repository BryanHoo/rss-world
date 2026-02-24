import { describe, expect, it } from 'vitest';
import { buildArticleFilter, decodeCursor, encodeCursor } from './readerSnapshotService';

describe('readerSnapshotService', () => {
  it('filters unread view', () => {
    const filter = buildArticleFilter({ view: 'unread' });
    expect(filter.whereSql).toMatch(/is_read = false/);
  });

  it('filters starred view', () => {
    const filter = buildArticleFilter({ view: 'starred' });
    expect(filter.whereSql).toMatch(/is_starred = true/);
  });

  it('filters feed view', () => {
    const filter = buildArticleFilter({ view: 'feed-id-1' });
    expect(filter.whereSql).toMatch(/feed_id/);
    expect(filter.params.length).toBe(1);
  });

  it('roundtrips cursor', () => {
    const cursor = encodeCursor({ publishedAt: '2026-01-01T00:00:00.000Z', id: 'id-1' });
    expect(decodeCursor(cursor)).toEqual({
      publishedAt: '2026-01-01T00:00:00.000Z',
      id: 'id-1',
    });
  });
});

