import type { PgBoss } from 'pg-boss';
import type { Pool } from 'pg';
import type { ArticleFilterSettings } from '../types';
import { getQueueSendOptions } from '../server/queue/contracts';
import { JOB_AI_TRANSLATE_TITLE } from '../server/queue/jobs';
import { getArticleById, setArticleFilterPending, setArticleFilterResult } from '../server/repositories/articlesRepo';
import { fetchFulltextAndStore } from '../server/fulltext/fetchFulltextAndStore';
import { evaluateArticleFilter } from '../server/services/articleFilterService';
import { evaluateArticleDuplicate, type ArticleDuplicateMatchResult } from '../server/services/articleDuplicateService';
import { enqueueAutoAiTriggersOnFetch } from './autoAiTriggers';

export interface ArticleFilterJobData {
  articleId: string;
  articleFilter: ArticleFilterSettings;
  feed: {
    fullTextOnFetchEnabled: boolean;
    aiSummaryOnFetchEnabled: boolean;
    bodyTranslateOnFetchEnabled: boolean;
    titleTranslateEnabled: boolean;
  };
}

type ArticleFilterWorkerDeps = {
  getArticleById: typeof getArticleById;
  setArticleFilterPending: typeof setArticleFilterPending;
  setArticleFilterResult: typeof setArticleFilterResult;
  fetchFulltextAndStore: typeof fetchFulltextAndStore;
  evaluateArticleDuplicate: typeof evaluateArticleDuplicate;
  evaluateArticleFilter: typeof evaluateArticleFilter;
  enqueueAutoAiTriggersOnFetch: typeof enqueueAutoAiTriggersOnFetch;
};

const defaultDeps: ArticleFilterWorkerDeps = {
  getArticleById,
  setArticleFilterPending,
  setArticleFilterResult,
  fetchFulltextAndStore,
  evaluateArticleDuplicate,
  evaluateArticleFilter,
  enqueueAutoAiTriggersOnFetch,
};

function buildDuplicateFilterFields(result: ArticleDuplicateMatchResult | null) {
  return {
    normalizedTitle: result?.normalizedTitle ?? null,
    normalizedLink: result?.normalizedLink ?? null,
    contentFingerprint: result?.contentFingerprint ?? null,
    duplicateOfArticleId: result?.duplicateOfArticleId ?? null,
    duplicateReason: result?.duplicateReason ?? null,
    duplicateScore: result?.duplicateScore ?? null,
  };
}

export async function runArticleFilterWorker(input: {
  pool: Pool;
  boss: Pick<PgBoss, 'send'>;
  job: ArticleFilterJobData;
  judgeAi: (payload: { prompt: string; articleText: string }) => Promise<{
    ok: boolean;
    matched: boolean;
    errorMessage: string | null;
  }>;
  deps?: Partial<ArticleFilterWorkerDeps>;
}): Promise<void> {
  const deps = { ...defaultDeps, ...(input.deps ?? {}) };
  const article = await deps.getArticleById(input.pool, input.job.articleId);
  if (!article) {
    return;
  }

  await deps.setArticleFilterPending(input.pool, article.id);

  let duplicateResult: ArticleDuplicateMatchResult | null = null;
  try {
    const prefilterResult = await deps.evaluateArticleFilter({
      article,
      filter: {
        keyword: input.job.articleFilter.keyword,
        ai: { enabled: false, prompt: '' },
      },
      judgeAi: async () => ({ ok: true, matched: false, errorMessage: null }),
    });

    if (prefilterResult.filterStatus === 'filtered') {
      await deps.setArticleFilterResult(input.pool, article.id, {
        filterStatus: 'filtered',
        isFiltered: true,
        filteredBy: prefilterResult.filteredBy,
        filterErrorMessage: null,
      });
      return;
    }

    duplicateResult = await deps.evaluateArticleDuplicate({
      pool: input.pool,
      article,
    });
    const duplicateFilterFields = buildDuplicateFilterFields(duplicateResult);

    if (duplicateResult.matched) {
      await deps.setArticleFilterResult(input.pool, article.id, {
        filterStatus: 'filtered',
        isFiltered: true,
        filteredBy: ['duplicate'],
        filterErrorMessage: null,
        ...duplicateFilterFields,
      });
      return;
    }

    let articleForFilter = article;
    if (input.job.feed.fullTextOnFetchEnabled) {
      await deps.fetchFulltextAndStore(input.pool, article.id);
      articleForFilter = (await deps.getArticleById(input.pool, article.id)) ?? article;
    }

    const result = await deps.evaluateArticleFilter({
      article: articleForFilter,
      filter: input.job.articleFilter,
      fullTextHtml: articleForFilter.contentFullHtml,
      fullTextError: articleForFilter.contentFullError,
      judgeAi: input.judgeAi,
    });

    await deps.setArticleFilterResult(input.pool, article.id, {
      filterStatus: result.filterStatus,
      isFiltered: result.isFiltered,
      filteredBy: result.filteredBy,
      filterErrorMessage: result.filterErrorMessage,
      ...duplicateFilterFields,
    });

    if (result.filterStatus !== 'passed') {
      return;
    }

    await deps.enqueueAutoAiTriggersOnFetch(input.boss, {
      feed: {
        aiSummaryOnFetchEnabled: input.job.feed.aiSummaryOnFetchEnabled,
        bodyTranslateOnFetchEnabled: input.job.feed.bodyTranslateOnFetchEnabled,
      },
      created: articleForFilter,
    });

    if (input.job.feed.titleTranslateEnabled && !articleForFilter.titleZh?.trim()) {
      await input.boss.send(
        JOB_AI_TRANSLATE_TITLE,
        { articleId: article.id },
        getQueueSendOptions(JOB_AI_TRANSLATE_TITLE, { articleId: article.id }),
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.trim() || 'Unknown error' : 'Unknown error';
    await deps.setArticleFilterResult(input.pool, article.id, {
      filterStatus: 'error',
      isFiltered: false,
      filteredBy: [],
      filterErrorMessage: message,
      ...buildDuplicateFilterFields(duplicateResult),
    });
  }
}
