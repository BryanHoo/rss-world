import { beforeEach, describe, expect, it, vi } from 'vitest';

const pool = {};
const getSystemLogsMock = vi.fn();

vi.mock('../../../server/db/pool', () => ({
  getPool: () => pool,
}));
vi.mock('../../../../server/db/pool', () => ({
  getPool: () => pool,
}));

vi.mock('../../../server/services/systemLogsService', () => ({
  getSystemLogs: (...args: unknown[]) => getSystemLogsMock(...args),
}));
vi.mock('../../../../server/services/systemLogsService', () => ({
  getSystemLogs: (...args: unknown[]) => getSystemLogsMock(...args),
}));

describe('/api/logs', () => {
  beforeEach(() => {
    getSystemLogsMock.mockReset();
  });

  it('returns logs page data', async () => {
    getSystemLogsMock.mockResolvedValue({
      items: [
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
      nextCursor: 'opaque-cursor',
      hasMore: true,
    });

    const mod = await import('./route');
    const res = await mod.GET(
      new Request('http://localhost/api/logs?level=error&limit=50&before=opaque-cursor'),
    );
    const json = await res.json();

    expect(getSystemLogsMock).toHaveBeenCalledWith(pool, {
      level: 'error',
      limit: 50,
      before: 'opaque-cursor',
    });
    expect(json.ok).toBe(true);
    expect(json.data.items[0].context).toEqual({ status: 429, durationMs: 812 });
    expect(json.data.nextCursor).toBe('opaque-cursor');
    expect(json.data.hasMore).toBe(true);
  });

  it('rejects unsupported level filters', async () => {
    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/logs?level=debug'));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('validation_error');
    expect(json.error.fields.level).toBeTruthy();
  });
});
