import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('articlesRepo (fulltext)', () => {
  it('writes fulltext html and error fields', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./articlesRepo')) as typeof import('./articlesRepo');

    if (typeof mod.setArticleFulltext !== 'function') {
      expect.fail('setArticleFulltext is not implemented');
    }
    if (typeof mod.setArticleFulltextError !== 'function') {
      expect.fail('setArticleFulltextError is not implemented');
    }

    await mod.setArticleFulltext(pool, 'article-1', {
      contentFullHtml: '<p>Hello</p>',
      sourceUrl: 'https://example.com/a',
    });
    expect(String(query.mock.calls[0]?.[0] ?? '')).toContain('content_full_html');

    await mod.setArticleFulltextError(pool, 'article-1', {
      error: 'timeout',
      sourceUrl: 'https://example.com/a',
    });
    expect(String(query.mock.calls[1]?.[0] ?? '')).toContain('content_full_error');
  });
});

