import { z } from 'zod';
import { getPool } from '../../../server/db/pool';
import { ok, fail } from '../../../server/http/apiResponse';
import { ValidationError } from '../../../server/http/errors';
import { getSystemLogs } from '../../../server/services/systemLogsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  level: z.enum(['error', 'warning', 'info']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  before: z.string().optional(),
});

function zodIssuesToFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'query';
    if (!fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      level: url.searchParams.get('level') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      before: url.searchParams.get('before') ?? undefined,
    });

    if (!parsed.success) {
      return fail(new ValidationError('Invalid query', zodIssuesToFields(parsed.error)));
    }

    const pool = getPool();
    const data = await getSystemLogs(pool, parsed.data);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
