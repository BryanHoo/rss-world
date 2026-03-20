import type { Pool } from 'pg';
import type { SystemLogsPage } from '../../types';
import { deleteAllSystemLogs, listSystemLogs } from '../repositories/systemLogsRepo';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function normalizeKeyword(input: string | undefined): string | undefined {
  const trimmed = input?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizePage(input: number | undefined): number {
  if (typeof input !== 'number' || Number.isNaN(input)) {
    return DEFAULT_PAGE;
  }

  return Math.max(DEFAULT_PAGE, Math.floor(input));
}

function normalizePageSize(input: number | undefined): number {
  if (typeof input !== 'number' || Number.isNaN(input)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(input)));
}

export async function getSystemLogs(
  pool: Pool,
  input: { keyword?: string; page?: number; pageSize?: number } = {},
): Promise<SystemLogsPage> {
  const page = normalizePage(input.page);
  const pageSize = normalizePageSize(input.pageSize);
  const result = await listSystemLogs(pool, {
    keyword: normalizeKeyword(input.keyword),
    page,
    pageSize,
  });

  return {
    items: result.items,
    page,
    pageSize,
    total: result.total,
    hasPreviousPage: page > 1,
    hasNextPage: page * pageSize < result.total,
  };
}

export async function clearSystemLogs(pool: Pool): Promise<{ deletedCount: number }> {
  const deletedCount = await deleteAllSystemLogs(pool);
  return { deletedCount };
}
