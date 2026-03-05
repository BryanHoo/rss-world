import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('feedsRepo (ai trigger flags)', () => {
  it('createFeed/updateFeed/listFeeds include ai trigger flags', async () => {
    const mod = (await import('./feedsRepo')) as typeof import('./feedsRepo');

    const listQuery = vi.fn().mockResolvedValue({ rows: [] });
    await mod.listFeeds({ query: listQuery } as unknown as Pool);
    const listSql = String(listQuery.mock.calls[0]?.[0] ?? '');
    expect(listSql).toContain('ai_summary_on_fetch_enabled');
    expect(listSql).toContain('aiSummaryOnFetchEnabled');
    expect(listSql).toContain('body_translate_on_fetch_enabled');
    expect(listSql).toContain('bodyTranslateOnFetchEnabled');
    expect(listSql).toContain('body_translate_on_open_enabled');
    expect(listSql).toContain('bodyTranslateOnOpenEnabled');

    const createQuery = vi.fn().mockResolvedValue({ rows: [{ id: 'f1' }] });
    await mod.createFeed(
      { query: createQuery } as unknown as Pool,
      { title: 'A', url: 'https://example.com/rss.xml' },
    );
    const createSql = String(createQuery.mock.calls[0]?.[0] ?? '');
    expect(createSql).toContain('ai_summary_on_fetch_enabled');
    expect(createSql).toContain('aiSummaryOnFetchEnabled');
    expect(createSql).toContain('body_translate_on_fetch_enabled');
    expect(createSql).toContain('bodyTranslateOnFetchEnabled');
    expect(createSql).toContain('body_translate_on_open_enabled');
    expect(createSql).toContain('bodyTranslateOnOpenEnabled');

    const updateQuery = vi.fn().mockResolvedValue({ rows: [{ id: 'f1' }] });
    await mod.updateFeed(
      { query: updateQuery } as unknown as Pool,
      'f1',
      {
        aiSummaryOnFetchEnabled: true,
        bodyTranslateOnFetchEnabled: true,
        bodyTranslateOnOpenEnabled: true,
        url: 'https://example.com/rss.xml',
      } as Parameters<typeof mod.updateFeed>[2],
    );
    const updateSql = String(updateQuery.mock.calls[0]?.[0] ?? '');
    expect(updateSql).toContain('ai_summary_on_fetch_enabled');
    expect(updateSql).toContain('aiSummaryOnFetchEnabled');
    expect(updateSql).toContain('body_translate_on_fetch_enabled');
    expect(updateSql).toContain('bodyTranslateOnFetchEnabled');
    expect(updateSql).toContain('body_translate_on_open_enabled');
    expect(updateSql).toContain('bodyTranslateOnOpenEnabled');
    expect(updateSql).toContain('url = $');
  });
});
