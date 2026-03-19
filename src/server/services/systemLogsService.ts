import type { Pool } from 'pg';
import { ValidationError } from '../http/errors';
import {
  listSystemLogs,
  type SystemLogCursor,
  type SystemLogItem,
  type SystemLogLevel,
} from '../repositories/systemLogsRepo';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function encodeSystemLogCursor(payload: SystemLogCursor): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeSystemLogCursor(cursor: string | null | undefined): SystemLogCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Partial<SystemLogCursor>;
    if (!parsed || typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
      return null;
    }

    return {
      createdAt: parsed.createdAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function normalizeLimit(input: number | null | undefined): number {
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(input ?? DEFAULT_LIMIT)));
}

export async function getSystemLogs(
  pool: Pool,
  input: { level?: SystemLogLevel; before?: string | null; limit?: number } = {},
): Promise<{ items: SystemLogItem[]; nextCursor: string | null; hasMore: boolean }> {
  const decodedBefore = decodeSystemLogCursor(input.before);
  if (input.before && !decodedBefore) {
    throw new ValidationError('Invalid query', {
      before: 'before 必须是服务端返回的游标',
    });
  }

  const result = await listSystemLogs(pool, {
    level: input.level,
    before: decodedBefore,
    limit: normalizeLimit(input.limit),
  });

  const lastItem = result.items[result.items.length - 1];
  return {
    items: result.items,
    nextCursor: result.hasMore && lastItem
      ? encodeSystemLogCursor({
          createdAt: lastItem.createdAt,
          id: lastItem.id,
        })
      : null,
    hasMore: result.hasMore,
  };
}
