import type { PgBoss } from 'pg-boss';
import { getQueueSendOptions } from '../server/queue/contracts';
import { JOB_AI_SUMMARIZE, JOB_AI_TRANSLATE } from '../server/queue/jobs';

interface FeedAutoAiTriggerFlags {
  aiSummaryOnFetchEnabled: boolean;
  bodyTranslateOnFetchEnabled: boolean;
}

interface CreatedArticleForAutoAi {
  id: string;
  aiSummary: string | null;
  aiTranslationBilingualHtml: string | null;
  aiTranslationZhHtml: string | null;
}

export async function enqueueAutoAiTriggersOnFetch(
  boss: Pick<PgBoss, 'send'>,
  input: {
    feed: FeedAutoAiTriggerFlags;
    created: CreatedArticleForAutoAi | null;
  },
): Promise<void> {
  const { feed, created } = input;
  if (!created) return;

  if (feed.aiSummaryOnFetchEnabled === true && !created.aiSummary?.trim()) {
    await boss.send(
      JOB_AI_SUMMARIZE,
      { articleId: created.id },
      getQueueSendOptions(JOB_AI_SUMMARIZE, { articleId: created.id }),
    );
  }

  if (
    feed.bodyTranslateOnFetchEnabled === true &&
    !(created.aiTranslationBilingualHtml?.trim() || created.aiTranslationZhHtml?.trim())
  ) {
    await boss.send(
      JOB_AI_TRANSLATE,
      { articleId: created.id },
      getQueueSendOptions(JOB_AI_TRANSLATE, { articleId: created.id }),
    );
  }
}
