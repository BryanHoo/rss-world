import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('articleFilterWorker', () => {
  const pool = { query: vi.fn() } as unknown as Pool;

  it('writes pending then filtered when summary prefilter matches and skips fulltext/ai', async () => {
    const boss = { send: vi.fn().mockResolvedValue('job-1') };
    const setArticleFilterPending = vi.fn().mockResolvedValue(undefined);
    const setArticleFilterResult = vi.fn().mockResolvedValue(undefined);
    const fetchFulltextAndStore = vi.fn().mockResolvedValue(undefined);
    const enqueueAutoAiTriggersOnFetch = vi.fn().mockResolvedValue(undefined);
    const evaluateArticleDuplicate = vi.fn();
    const evaluateArticleFilter = vi
      .fn()
      .mockResolvedValueOnce({
        filterStatus: 'filtered',
        isFiltered: true,
        filteredBy: ['keyword'],
        filterErrorMessage: null,
      });

    const { runArticleFilterWorker } = await import('./articleFilterWorker');
    await runArticleFilterWorker({
      pool,
      boss,
      job: {
        articleId: 'a1',
        articleFilter: {
          keyword: { enabled: true, keywords: ['Sponsored'] },
          ai: { enabled: true, prompt: '过滤广告' },
        },
        feed: {
          fullTextOnFetchEnabled: true,
          aiSummaryOnFetchEnabled: true,
          bodyTranslateOnFetchEnabled: true,
          titleTranslateEnabled: true,
        },
      },
      judgeAi: vi.fn(),
      deps: {
        getArticleById: vi.fn().mockResolvedValue({
          id: 'a1',
          title: 'Sponsored post',
          summary: 'Weekly roundup',
          titleZh: null,
        }),
        setArticleFilterPending,
        setArticleFilterResult,
        fetchFulltextAndStore,
        evaluateArticleDuplicate,
        evaluateArticleFilter,
        enqueueAutoAiTriggersOnFetch,
      } as Parameters<typeof runArticleFilterWorker>[0]['deps'] & {
        evaluateArticleDuplicate: typeof evaluateArticleDuplicate;
      },
    });

    expect(setArticleFilterPending).toHaveBeenCalledWith(pool, 'a1');
    expect(evaluateArticleDuplicate).not.toHaveBeenCalled();
    expect(setArticleFilterResult).toHaveBeenCalledWith(
      pool,
      'a1',
      expect.objectContaining({
        filterStatus: 'filtered',
        isFiltered: true,
        filteredBy: ['keyword'],
      }),
    );
    expect(fetchFulltextAndStore).not.toHaveBeenCalled();
    expect(enqueueAutoAiTriggersOnFetch).not.toHaveBeenCalled();
    expect(boss.send).not.toHaveBeenCalled();
  });

  it('writes duplicate filtered result before fulltext and ai work', async () => {
    const boss = { send: vi.fn().mockResolvedValue('job-1') };
    const setArticleFilterResult = vi.fn().mockResolvedValue(undefined);
    const fetchFulltextAndStore = vi.fn().mockResolvedValue(undefined);
    const enqueueAutoAiTriggersOnFetch = vi.fn().mockResolvedValue(undefined);
    const evaluateArticleDuplicate = vi.fn().mockResolvedValue({
      matched: true,
      duplicateOfArticleId: 'a0',
      duplicateReason: 'similar_content',
      duplicateScore: 0.93,
      normalizedTitle: 'same title',
      normalizedLink: 'https://example.com/post',
      contentFingerprint: 'abcd1234',
    });
    const evaluateArticleFilter = vi
      .fn()
      .mockResolvedValueOnce({
        filterStatus: 'passed',
        isFiltered: false,
        filteredBy: [],
        filterErrorMessage: null,
      });

    const { runArticleFilterWorker } = await import('./articleFilterWorker');
    await runArticleFilterWorker({
      pool,
      boss,
      job: {
        articleId: 'a1',
        articleFilter: {
          keyword: { enabled: true, keywords: ['Sponsored'] },
          ai: { enabled: true, prompt: '过滤广告' },
        },
        feed: {
          fullTextOnFetchEnabled: true,
          aiSummaryOnFetchEnabled: true,
          bodyTranslateOnFetchEnabled: true,
          titleTranslateEnabled: true,
        },
      },
      judgeAi: vi.fn(),
      deps: {
        getArticleById: vi.fn().mockResolvedValue({
          id: 'a1',
          title: 'Weekly roundup',
          summary: 'General summary',
          titleZh: null,
        }),
        setArticleFilterPending: vi.fn().mockResolvedValue(undefined),
        setArticleFilterResult,
        fetchFulltextAndStore,
        evaluateArticleDuplicate,
        evaluateArticleFilter,
        enqueueAutoAiTriggersOnFetch,
      } as Parameters<typeof runArticleFilterWorker>[0]['deps'] & {
        evaluateArticleDuplicate: typeof evaluateArticleDuplicate;
      },
    });

    expect(setArticleFilterResult).toHaveBeenCalledWith(
      pool,
      'a1',
      expect.objectContaining({
        filterStatus: 'filtered',
        isFiltered: true,
        filteredBy: ['duplicate'],
        duplicateOfArticleId: 'a0',
        duplicateReason: 'similar_content',
        duplicateScore: 0.93,
        normalizedTitle: 'same title',
        normalizedLink: 'https://example.com/post',
        contentFingerprint: 'abcd1234',
      }),
    );
    expect(fetchFulltextAndStore).not.toHaveBeenCalled();
    expect(enqueueAutoAiTriggersOnFetch).not.toHaveBeenCalled();
    expect(boss.send).not.toHaveBeenCalled();
  });

  it('fetches fulltext and triggers downstream jobs only after passed result', async () => {
    const boss = { send: vi.fn().mockResolvedValue('job-1') };
    const setArticleFilterResult = vi.fn().mockResolvedValue(undefined);
    const fetchFulltextAndStore = vi.fn().mockResolvedValue(undefined);
    const enqueueAutoAiTriggersOnFetch = vi.fn().mockResolvedValue(undefined);
    const evaluateArticleDuplicate = vi.fn().mockResolvedValue({
      matched: false,
      duplicateOfArticleId: null,
      duplicateReason: null,
      duplicateScore: null,
      normalizedTitle: 'weekly roundup',
      normalizedLink: 'https://example.com/weekly-roundup',
      contentFingerprint: 'abcd1234',
    });
    const articleAfterFetch = {
      id: 'a1',
      title: 'Weekly roundup',
      summary: 'General summary',
      titleZh: null,
      contentFullHtml: '<article><p>Full text</p></article>',
      contentFullError: null,
      aiSummary: null,
      aiTranslationBilingualHtml: null,
      aiTranslationZhHtml: null,
      sourceLanguage: 'en',
      contentHtml: '<p>Summary</p>',
    };
    const getArticleById = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'a1',
        title: 'Weekly roundup',
        summary: 'General summary',
        titleZh: null,
      })
      .mockResolvedValueOnce(articleAfterFetch);
    const evaluateArticleFilter = vi
      .fn()
      .mockResolvedValueOnce({
        filterStatus: 'passed',
        isFiltered: false,
        filteredBy: [],
        filterErrorMessage: null,
      })
      .mockResolvedValueOnce({
        filterStatus: 'passed',
        isFiltered: false,
        filteredBy: [],
        filterErrorMessage: null,
      });

    const { runArticleFilterWorker } = await import('./articleFilterWorker');
    await runArticleFilterWorker({
      pool,
      boss,
      job: {
        articleId: 'a1',
        articleFilter: {
          keyword: { enabled: true, keywords: ['Sponsored'] },
          ai: { enabled: true, prompt: '过滤广告' },
        },
        feed: {
          fullTextOnFetchEnabled: true,
          aiSummaryOnFetchEnabled: true,
          bodyTranslateOnFetchEnabled: true,
          titleTranslateEnabled: true,
        },
      },
      judgeAi: vi.fn().mockResolvedValue({ ok: true, matched: false, errorMessage: null }),
      deps: {
        getArticleById,
        setArticleFilterPending: vi.fn().mockResolvedValue(undefined),
        setArticleFilterResult,
        fetchFulltextAndStore,
        evaluateArticleDuplicate,
        evaluateArticleFilter,
        enqueueAutoAiTriggersOnFetch,
      } as Parameters<typeof runArticleFilterWorker>[0]['deps'] & {
        evaluateArticleDuplicate: typeof evaluateArticleDuplicate;
      },
    });

    expect(fetchFulltextAndStore).toHaveBeenCalledWith(pool, 'a1');
    expect(setArticleFilterResult).toHaveBeenLastCalledWith(
      pool,
      'a1',
      expect.objectContaining({
        filterStatus: 'passed',
        normalizedTitle: 'weekly roundup',
        normalizedLink: 'https://example.com/weekly-roundup',
        contentFingerprint: 'abcd1234',
      }),
    );
    expect(enqueueAutoAiTriggersOnFetch).toHaveBeenCalledWith(
      boss,
      expect.objectContaining({ created: articleAfterFetch }),
    );
    expect(boss.send).toHaveBeenCalledWith(
      'ai.translate_title_zh',
      { articleId: 'a1' },
      expect.any(Object),
    );
  });

  it('writes error instead of leaving article pending when worker throws', async () => {
    const setArticleFilterResult = vi.fn().mockResolvedValue(undefined);
    const evaluateArticleDuplicate = vi.fn().mockResolvedValue({
      matched: false,
      duplicateOfArticleId: null,
      duplicateReason: null,
      duplicateScore: null,
      normalizedTitle: 'weekly roundup',
      normalizedLink: 'https://example.com/weekly-roundup',
      contentFingerprint: 'abcd1234',
    });

    const { runArticleFilterWorker } = await import('./articleFilterWorker');
    await runArticleFilterWorker({
      pool,
      boss: { send: vi.fn().mockResolvedValue('job-1') },
      job: {
        articleId: 'a1',
        articleFilter: {
          keyword: { enabled: true, keywords: ['Sponsored'] },
          ai: { enabled: false, prompt: '' },
        },
        feed: {
          fullTextOnFetchEnabled: false,
          aiSummaryOnFetchEnabled: false,
          bodyTranslateOnFetchEnabled: false,
          titleTranslateEnabled: false,
        },
      },
      judgeAi: vi.fn(),
      deps: {
        getArticleById: vi.fn().mockResolvedValue({
          id: 'a1',
          title: 'Weekly roundup',
          summary: 'General summary',
          titleZh: null,
        }),
        setArticleFilterPending: vi.fn().mockResolvedValue(undefined),
        setArticleFilterResult,
        fetchFulltextAndStore: vi.fn().mockResolvedValue(undefined),
        evaluateArticleDuplicate,
        evaluateArticleFilter: vi.fn().mockRejectedValue(new Error('boom')),
        enqueueAutoAiTriggersOnFetch: vi.fn().mockResolvedValue(undefined),
      } as Parameters<typeof runArticleFilterWorker>[0]['deps'] & {
        evaluateArticleDuplicate: typeof evaluateArticleDuplicate;
      },
    });

    expect(setArticleFilterResult).toHaveBeenLastCalledWith(
      pool,
      'a1',
      expect.objectContaining({
        filterStatus: 'error',
        isFiltered: false,
        filterErrorMessage: 'boom',
      }),
    );
  });

  it('uses frozen payload flags to avoid triggering title translation when disabled', async () => {
    const boss = { send: vi.fn().mockResolvedValue('job-1') };
    const evaluateArticleDuplicate = vi.fn().mockResolvedValue({
      matched: false,
      duplicateOfArticleId: null,
      duplicateReason: null,
      duplicateScore: null,
      normalizedTitle: 'weekly roundup',
      normalizedLink: 'https://example.com/weekly-roundup',
      contentFingerprint: 'abcd1234',
    });

    const { runArticleFilterWorker } = await import('./articleFilterWorker');
    await runArticleFilterWorker({
      pool,
      boss,
      job: {
        articleId: 'a1',
        articleFilter: {
          keyword: { enabled: false, keywords: [] },
          ai: { enabled: false, prompt: '' },
        },
        feed: {
          fullTextOnFetchEnabled: false,
          aiSummaryOnFetchEnabled: false,
          bodyTranslateOnFetchEnabled: false,
          titleTranslateEnabled: false,
        },
      },
      judgeAi: vi.fn(),
      deps: {
        getArticleById: vi.fn().mockResolvedValue({
          id: 'a1',
          title: 'Weekly roundup',
          summary: 'General summary',
          titleZh: null,
        }),
        setArticleFilterPending: vi.fn().mockResolvedValue(undefined),
        setArticleFilterResult: vi.fn().mockResolvedValue(undefined),
        fetchFulltextAndStore: vi.fn().mockResolvedValue(undefined),
        evaluateArticleDuplicate,
        evaluateArticleFilter: vi
          .fn()
          .mockResolvedValueOnce({
            filterStatus: 'passed',
            isFiltered: false,
            filteredBy: [],
            filterErrorMessage: null,
          })
          .mockResolvedValueOnce({
            filterStatus: 'passed',
            isFiltered: false,
            filteredBy: [],
            filterErrorMessage: null,
          }),
        enqueueAutoAiTriggersOnFetch: vi.fn().mockResolvedValue(undefined),
      } as Parameters<typeof runArticleFilterWorker>[0]['deps'] & {
        evaluateArticleDuplicate: typeof evaluateArticleDuplicate;
      },
    });

    expect(boss.send).not.toHaveBeenCalledWith(
      'ai.translate_title_zh',
      expect.anything(),
      expect.anything(),
    );
  });
});
