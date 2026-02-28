import { z } from 'zod';
import { getPool } from '../../../../../server/db/pool';
import { ok, fail } from '../../../../../server/http/apiResponse';
import { NotFoundError, ValidationError } from '../../../../../server/http/errors';
import { getArticleById } from '../../../../../server/repositories/articlesRepo';
import { getAiApiKey } from '../../../../../server/repositories/settingsRepo';
import { enqueue } from '../../../../../server/queue/queue';
import { JOB_AI_SUMMARIZE } from '../../../../../server/queue/jobs';

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

    const articleId = paramsParsed.data.id;
    const pool = getPool();

    const article = await getArticleById(pool, articleId);
    if (!article) return fail(new NotFoundError('Article not found'));

    const aiApiKey = await getAiApiKey(pool);
    if (!aiApiKey.trim()) {
      return ok({ enqueued: false, reason: 'missing_api_key' });
    }

    if (article.aiSummary && article.aiSummary.trim()) {
      return ok({ enqueued: false, reason: 'already_summarized' });
    }

    try {
      const jobId = await enqueue(
        JOB_AI_SUMMARIZE,
        { articleId },
        { singletonKey: articleId, singletonSeconds: 600, retryLimit: 8, retryDelay: 30 },
      );
      return ok({ enqueued: true, jobId });
    } catch (err) {
      if (err instanceof Error && err.message === 'Failed to enqueue job') {
        return ok({ enqueued: false, reason: 'already_enqueued' });
      }
      throw err;
    }
  } catch (err) {
    return fail(err);
  }
}

