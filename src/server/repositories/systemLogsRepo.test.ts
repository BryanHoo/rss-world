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

  it('lists logs with level filter, before cursor boundary and mapped context', async () => {
    const query = vi.fn().mockResolvedValue({
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
        {
          id: '127',
          level: 'error',
          category: 'external_api',
          message: 'older log',
          details: null,
          source: 'aiSummaryStreamWorker',
          context: {},
          createdAt: '2026-03-19T10:10:00.000Z',
        },
      ],
    });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./systemLogsRepo')) as typeof import('./systemLogsRepo');

    const result = await mod.listSystemLogs(pool, {
      level: 'error',
      before: { createdAt: '2026-03-19T11:00:00.000Z', id: '129' },
      limit: 1,
    });

    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('from system_logs');
    expect(sql).toContain('context_json as context');
    expect(sql).toContain('level = $1');
    expect(sql).toContain('(created_at, id) < ($2::timestamptz, $3::bigint)');
    expect(sql).toContain('order by created_at desc, id desc');
    expect(query.mock.calls[0]?.[1]).toEqual(['error', '2026-03-19T11:00:00.000Z', '129', 2]);
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
    expect(result.hasMore).toBe(true);
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
});
