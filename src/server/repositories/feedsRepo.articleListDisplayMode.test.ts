import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('feedsRepo (articleListDisplayMode)', () => {
  it('listFeeds selects article_list_display_mode', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./feedsRepo')) as typeof import('./feedsRepo');

    await mod.listFeeds(pool);
    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('article_list_display_mode');
    expect(sql).toContain('articleListDisplayMode');
  });

  it('createFeed inserts and returns article_list_display_mode', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'f1' }] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./feedsRepo')) as typeof import('./feedsRepo');

    await mod.createFeed(pool, { title: 'A', url: 'https://example.com/rss.xml' });
    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('article_list_display_mode');
    expect(sql).toContain('articleListDisplayMode');
  });

  it('updateFeed supports articleListDisplayMode and url patch and returns it', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'f1' }] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./feedsRepo')) as typeof import('./feedsRepo');

    await mod.updateFeed(pool, 'f1', {
      articleListDisplayMode: 'list',
      url: 'https://example.com/rss.xml',
    });

    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('article_list_display_mode');
    expect(sql).toContain('articleListDisplayMode');
    expect(sql).toContain('url = $');
  });
});
