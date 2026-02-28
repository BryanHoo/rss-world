import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('feedsRepo (aiSummaryOnOpenEnabled)', () => {
  it('listFeeds selects ai_summary_on_open_enabled', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./feedsRepo')) as typeof import('./feedsRepo');

    await mod.listFeeds(pool);
    expect(String(query.mock.calls[0]?.[0] ?? '')).toContain('ai_summary_on_open_enabled');
    expect(String(query.mock.calls[0]?.[0] ?? '')).toContain('aiSummaryOnOpenEnabled');
  });

  it('createFeed inserts and returns ai_summary_on_open_enabled', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'f1' }] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./feedsRepo')) as typeof import('./feedsRepo');

    await mod.createFeed(pool, { title: 'A', url: 'https://example.com/rss.xml' });
    expect(String(query.mock.calls[0]?.[0] ?? '')).toContain('ai_summary_on_open_enabled');
    expect(String(query.mock.calls[0]?.[0] ?? '')).toContain('aiSummaryOnOpenEnabled');
  });

  it('updateFeed supports aiSummaryOnOpenEnabled patch and returns it', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'f1' }] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./feedsRepo')) as typeof import('./feedsRepo');

    await mod.updateFeed(pool, 'f1', { aiSummaryOnOpenEnabled: true });

    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('ai_summary_on_open_enabled');
    expect(sql).toContain('aiSummaryOnOpenEnabled');
  });
});
