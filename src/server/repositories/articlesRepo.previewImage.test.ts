import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('articlesRepo (preview image)', () => {
  it('inserts preview_image_url when provided', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./articlesRepo')) as typeof import('./articlesRepo');

    await mod.insertArticleIgnoreDuplicate(
      pool,
      {
        feedId: 'feed-1',
        dedupeKey: 'guid:1',
        title: 'Hello',
        previewImageUrl: 'https://example.com/cover.jpg',
      } as never,
    );

    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('preview_image_url');

    const values = query.mock.calls[0]?.[1] as unknown[];
    expect(values).toContain('https://example.com/cover.jpg');
  });
});

