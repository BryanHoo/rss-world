import { z } from 'zod';
import { ok, fail } from '../../../../../server/http/apiResponse';
import { ValidationError } from '../../../../../server/http/errors';
import { enqueue } from '../../../../../server/queue/queue';

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

    const jobId = await enqueue('feed.fetch', { feedId: paramsParsed.data.id });
    return ok({ enqueued: true, jobId });
  } catch (err) {
    return fail(err);
  }
}
