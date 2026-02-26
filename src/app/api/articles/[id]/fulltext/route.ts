import { z } from 'zod';
import { getPool } from '../../../../../server/db/pool';
import { ok, fail } from '../../../../../server/http/apiResponse';
import { NotFoundError, ValidationError } from '../../../../../server/http/errors';
import { getArticleById } from '../../../../../server/repositories/articlesRepo';
import { getUiSettings } from '../../../../../server/repositories/settingsRepo';
import { normalizePersistedSettings } from '../../../../../features/settings/settingsSchema';
import { enqueue } from '../../../../../server/queue/queue';
import { JOB_ARTICLE_FULLTEXT_FETCH } from '../../../../../server/queue/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

function zodIssuesToFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'body';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const paramsParsed = paramsSchema.safeParse(params);
    if (!paramsParsed.success) {
      return fail(
        new ValidationError('Invalid route params', zodIssuesToFields(paramsParsed.error)),
      );
    }

    const pool = getPool();
    const rawSettings = await getUiSettings(pool);
    const uiSettings = normalizePersistedSettings(rawSettings);
    if (!uiSettings.rss.fullTextOnOpenEnabled) {
      return ok({ enqueued: false });
    }

    const article = await getArticleById(pool, paramsParsed.data.id);
    if (!article) return fail(new NotFoundError('Article not found'));
    if (!article.link) return ok({ enqueued: false });
    if (article.contentFullHtml) return ok({ enqueued: false });

    const articleId = paramsParsed.data.id;

    try {
      const jobId = await enqueue(
        JOB_ARTICLE_FULLTEXT_FETCH,
        { articleId },
        { singletonKey: articleId, singletonSeconds: 600 },
      );
      return ok({ enqueued: true, jobId });
    } catch (err) {
      if (err instanceof Error && err.message === 'Failed to enqueue job') {
        return ok({ enqueued: false });
      }
      throw err;
    }
  } catch (err) {
    return fail(err);
  }
}

