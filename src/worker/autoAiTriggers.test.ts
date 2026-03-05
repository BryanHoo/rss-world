import type { PgBoss } from 'pg-boss';
import { describe, expect, it, vi } from 'vitest';
import { getQueueSendOptions } from '../server/queue/contracts';
import { JOB_AI_SUMMARIZE, JOB_AI_TRANSLATE } from '../server/queue/jobs';

describe('auto ai triggers', () => {
  it('enqueues ai_summary and ai_translate after insert when feed on-fetch flags are enabled', async () => {
    const send = vi.fn().mockResolvedValue('job-id-1');
    const { enqueueAutoAiTriggersOnFetch } = await import('./autoAiTriggers');

    await enqueueAutoAiTriggersOnFetch(
      { send } as unknown as Pick<PgBoss, 'send'>,
      {
        feed: {
          aiSummaryOnFetchEnabled: true,
          bodyTranslateOnFetchEnabled: true,
        },
        created: {
          id: 'article-1',
          aiSummary: null,
          aiTranslationBilingualHtml: null,
          aiTranslationZhHtml: null,
        },
      },
    );

    expect(send).toHaveBeenCalledWith(
      JOB_AI_SUMMARIZE,
      { articleId: 'article-1' },
      getQueueSendOptions(JOB_AI_SUMMARIZE, { articleId: 'article-1' }),
    );
    expect(send).toHaveBeenCalledWith(
      JOB_AI_TRANSLATE,
      { articleId: 'article-1' },
      getQueueSendOptions(JOB_AI_TRANSLATE, { articleId: 'article-1' }),
    );
  });

  it('does not enqueue duplicate when article already has summary/translation', async () => {
    const send = vi.fn().mockResolvedValue('job-id-1');
    const { enqueueAutoAiTriggersOnFetch } = await import('./autoAiTriggers');

    await enqueueAutoAiTriggersOnFetch(
      { send } as unknown as Pick<PgBoss, 'send'>,
      {
        feed: {
          aiSummaryOnFetchEnabled: true,
          bodyTranslateOnFetchEnabled: true,
        },
        created: {
          id: 'article-1',
          aiSummary: '已有摘要',
          aiTranslationBilingualHtml: null,
          aiTranslationZhHtml: '<p>已有翻译</p>',
        },
      },
    );

    expect(send).not.toHaveBeenCalled();
  });
});
