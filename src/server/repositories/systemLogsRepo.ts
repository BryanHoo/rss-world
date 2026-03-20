import type { Pool, PoolClient } from 'pg';
import type { SystemLogItem, SystemLogLevel } from '../../types';

export type { SystemLogItem, SystemLogLevel };

type Queryable = Pool | PoolClient;

function normalizeContext(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function insertSystemLog(
  pool: Queryable,
  input: Omit<SystemLogItem, 'id' | 'createdAt'>,
): Promise<void> {
  await pool.query(
    `
      insert into system_logs (
        level,
        category,
        message,
        details,
        source,
        context_json
      )
      values ($1, $2, $3, $4, $5, $6)
    `,
    [
      input.level,
      input.category,
      input.message,
      input.details,
      input.source,
      input.context,
    ],
  );
}

export async function listSystemLogs(
  pool: Queryable,
  input: { keyword?: string; page: number; pageSize: number },
): Promise<{ items: SystemLogItem[]; total: number }> {
  const keyword = input.keyword?.trim();
  const params = keyword ? [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`] : [];
  const whereSql = keyword
    ? 'where (message ilike $1 or source ilike $2 or category ilike $3)'
    : '';
  const offset = (input.page - 1) * input.pageSize;

  const countResult = await pool.query<{ count: string }>(
    `
      select count(*)::text as count
      from system_logs
      ${whereSql}
    `,
    params,
  );

  const { rows } = await pool.query<SystemLogItem & { context: unknown }>(
    `
      select
        id::text as id,
        level,
        category,
        message,
        details,
        source,
        context_json as context,
        created_at as "createdAt"
      from system_logs
      ${whereSql}
      order by created_at desc, id desc
      offset $${params.length + 1}
      limit $${params.length + 2}
    `,
    [...params, offset, input.pageSize],
  );

  const items = rows.map((row) => ({
    ...row,
    context: normalizeContext(row.context),
  }));
  const total = Number(countResult.rows[0]?.count ?? 0);

  return { items, total };
}

export async function deleteExpiredSystemLogs(
  pool: Queryable,
  input: { retentionDays: number },
): Promise<number> {
  const result = await pool.query(
    `
      delete from system_logs
      where created_at < now() - make_interval(days => $1)
    `,
    [input.retentionDays],
  );

  return result.rowCount ?? 0;
}
