import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('articlesRepo (ai summary)', () => {
  it('getArticleById selects ai_summary fields', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./articlesRepo')) as typeof import('./articlesRepo');

    await mod.getArticleById(pool, 'a1');

    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('ai_summary');
    expect(sql).toContain('ai_summary_model');
    expect(sql).toContain('ai_summarized_at');
  });

  it('setArticleAiSummary updates ai_summary fields', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./articlesRepo')) as typeof import('./articlesRepo');

    const setArticleAiSummary = (
      mod as Partial<{
        setArticleAiSummary: (
          pool: Pool,
          id: string,
          input: { aiSummary: string; aiSummaryModel: string },
        ) => Promise<void>;
      }>
    ).setArticleAiSummary;

    if (typeof setArticleAiSummary !== 'function') {
      expect.fail('setArticleAiSummary is not implemented');
    }

    await setArticleAiSummary(pool, 'a1', {
      aiSummary: 'hello',
      aiSummaryModel: 'gpt-4o-mini',
    });

    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('ai_summary');
    expect(sql).toContain('ai_summarized_at');
  });
});

