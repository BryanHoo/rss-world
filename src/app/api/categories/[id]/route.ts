import { z } from 'zod';
import { getPool } from '../../../../server/db/pool';
import { ok, fail } from '../../../../server/http/apiResponse';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../../server/http/errors';
import {
  deleteCategory,
  updateCategory,
} from '../../../../server/repositories/categoriesRepo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const patchBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
    path: ['body'],
  });

function zodIssuesToFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'body';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

function isUniqueViolation(
  err: unknown,
  constraint: string,
): err is { code: string; constraint?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505' &&
    (!('constraint' in err) || (err as { constraint?: unknown }).constraint === constraint)
  );
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } },
) {
  try {
    const paramsParsed = paramsSchema.safeParse(context.params);
    if (!paramsParsed.success) {
      return fail(
        new ValidationError('Invalid route params', zodIssuesToFields(paramsParsed.error)),
      );
    }

    const json = await request.json().catch(() => null);
    const bodyParsed = patchBodySchema.safeParse(json);
    if (!bodyParsed.success) {
      return fail(new ValidationError('Invalid request body', zodIssuesToFields(bodyParsed.error)));
    }

    const pool = getPool();
    const updated = await updateCategory(pool, paramsParsed.data.id, bodyParsed.data);
    if (!updated) return fail(new NotFoundError('Category not found'));
    return ok(updated);
  } catch (err) {
    if (isUniqueViolation(err, 'categories_name_unique')) {
      return fail(new ConflictError('Category already exists', { name: 'duplicate' }));
    }
    return fail(err);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } },
) {
  try {
    const paramsParsed = paramsSchema.safeParse(context.params);
    if (!paramsParsed.success) {
      return fail(
        new ValidationError('Invalid route params', zodIssuesToFields(paramsParsed.error)),
      );
    }

    const pool = getPool();
    const deleted = await deleteCategory(pool, paramsParsed.data.id);
    if (!deleted) return fail(new NotFoundError('Category not found'));

    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}

