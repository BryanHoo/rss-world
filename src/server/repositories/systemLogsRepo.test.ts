import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('systemLogsRepo', () => {
  it('inserts system logs with details and context_json payloads', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./systemLogsRepo')) as typeof import('./systemLogsRepo');

    await mod.insertSystemLog(pool, {
      level: 'error',
      category: 'external_api',
      message: 'AI summary request failed',
      details: '{"error":{"message":"Rate limit exceeded"}}',
      source: 'server/ai/streamSummarizeText',
      context: { status: 429, durationMs: 812 },
    });

    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('insert into system_logs');
    expect(sql).toContain('context_json');
    expect(query.mock.calls[0]?.[1]).toEqual([
      'error',
      'external_api',
      'AI summary request failed',
      '{"error":{"message":"Rate limit exceeded"}}',
      'server/ai/streamSummarizeText',
      { status: 429, durationMs: 812 },
    ]);
  });

  it('lists logs with keyword search, offset pagination and mapped context', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: '42' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '128',
            level: 'error',
            category: 'external_api',
            message: 'AI summary request failed',
            details: '{"error":{"message":"Rate limit exceeded"}}',
            source: 'aiSummaryStreamWorker',
            context: { status: 429, durationMs: 812 },
            createdAt: '2026-03-19T10:12:30.000Z',
          },
        ],
      });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./systemLogsRepo')) as typeof import('./systemLogsRepo');

    const result = await mod.listSystemLogs(pool, {
      keyword: 'summary',
      page: 2,
      pageSize: 20,
    });

    const countSql = String(query.mock.calls[0]?.[0] ?? '');
    const pageSql = String(query.mock.calls[1]?.[0] ?? '');
    expect(countSql).toContain('count(*)');
    expect(countSql).toContain('message ilike $1');
    expect(countSql).toContain('source ilike $2');
    expect(countSql).toContain('category ilike $3');
    expect(query.mock.calls[0]?.[1]).toEqual(['%summary%', '%summary%', '%summary%']);
    expect(pageSql).toContain('from system_logs');
    expect(pageSql).toContain('context_json as context');
    expect(pageSql).toContain('order by created_at desc, id desc');
    expect(pageSql).toContain('offset $4');
    expect(pageSql).toContain('limit $5');
    expect(query.mock.calls[1]?.[1]).toEqual(['%summary%', '%summary%', '%summary%', 20, 20]);
    expect(result.items).toEqual([
      {
        id: '128',
        level: 'error',
        category: 'external_api',
        message: 'AI summary request failed',
        details: '{"error":{"message":"Rate limit exceeded"}}',
        source: 'aiSummaryStreamWorker',
        context: { status: 429, durationMs: 812 },
        createdAt: '2026-03-19T10:12:30.000Z',
      },
    ]);
    expect(result.total).toBe(42);
  });

  it('deletes expired logs using retention days', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 3 });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./systemLogsRepo')) as typeof import('./systemLogsRepo');

    const deletedCount = await mod.deleteExpiredSystemLogs(pool, { retentionDays: 30 });

    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('delete from system_logs');
    expect(sql).toContain('make_interval(days => $1)');
    expect(query.mock.calls[0]?.[1]).toEqual([30]);
    expect(deletedCount).toBe(3);
  });

  it('deletes all logs without filters', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 42 });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./systemLogsRepo')) as typeof import('./systemLogsRepo');

    const deletedCount = await mod.deleteAllSystemLogs(pool);

    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('delete from system_logs');
    expect(query.mock.calls[0]?.[1]).toBeUndefined();
    expect(deletedCount).toBe(42);
  });
});
