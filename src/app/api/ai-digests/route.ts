import { z } from 'zod';
import { getPool } from '../../../server/db/pool';
import { ok, fail } from '../../../server/http/apiResponse';
import { ValidationError } from '../../../server/http/errors';
import { createAiDigestWithCategoryResolution } from '../../../server/services/aiDigestLifecycleService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const categoryInputShape = {
  categoryId: z.string().uuid().nullable().optional(),
  categoryName: z.string().trim().min(1).nullable().optional(),
};

const INTERVAL_OPTIONS_MINUTES = [60, 120, 240, 480, 1440] as const;

const bodySchema = z
  .object({
    title: z.string().trim().min(1),
    prompt: z.string().trim().min(1),
    intervalMinutes: z.number().int(),
    selectedFeedIds: z.array(z.string().uuid()).default([]),
    selectedCategoryIds: z.array(z.string().uuid()).default([]),
    ...categoryInputShape,
  })
  .refine((value) => !(value.categoryId && value.categoryName), {
    path: ['categoryName'],
    message: 'categoryId and categoryName are mutually exclusive',
  })
  .refine((value) => INTERVAL_OPTIONS_MINUTES.includes(value.intervalMinutes as never), {
    path: ['intervalMinutes'],
    message: 'intervalMinutes is not in allowed options',
  })
  .refine((value) => value.selectedFeedIds.length > 0 || value.selectedCategoryIds.length > 0, {
    path: ['selectedFeedIds'],
    message: 'at least one source is required',
  });

function zodIssuesToFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'body';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail(new ValidationError('Invalid request body', zodIssuesToFields(parsed.error)));
    }

    const pool = getPool();
    const created = await createAiDigestWithCategoryResolution(pool, parsed.data);
    return ok({ ...created, unreadCount: 0 });
  } catch (err) {
    return fail(err);
  }
}

