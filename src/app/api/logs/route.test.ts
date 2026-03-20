import { beforeEach, describe, expect, it, vi } from 'vitest';

const pool = {};
const getSystemLogsMock = vi.fn();
const clearSystemLogsMock = vi.fn();

vi.mock('../../../server/db/pool', () => ({
  getPool: () => pool,
}));
vi.mock('../../../../server/db/pool', () => ({
  getPool: () => pool,
}));

vi.mock('../../../server/services/systemLogsService', () => ({
  getSystemLogs: (...args: unknown[]) => getSystemLogsMock(...args),
  clearSystemLogs: (...args: unknown[]) => clearSystemLogsMock(...args),
}));
vi.mock('../../../../server/services/systemLogsService', () => ({
  getSystemLogs: (...args: unknown[]) => getSystemLogsMock(...args),
  clearSystemLogs: (...args: unknown[]) => clearSystemLogsMock(...args),
}));

describe('/api/logs', () => {
  beforeEach(() => {
    getSystemLogsMock.mockReset();
    clearSystemLogsMock.mockReset();
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
      page: 2,
      pageSize: 20,
      total: 42,
      hasPreviousPage: true,
      hasNextPage: true,
    });

    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/logs?keyword=summary&page=2&pageSize=20'));
    const json = await res.json();

    expect(getSystemLogsMock).toHaveBeenCalledWith(pool, {
      keyword: 'summary',
      page: 2,
      pageSize: 20,
    });
    expect(json.ok).toBe(true);
    expect(json.data.items[0].context).toEqual({ status: 429, durationMs: 812 });
    expect(json.data.page).toBe(2);
    expect(json.data.total).toBe(42);
    expect(json.data.hasNextPage).toBe(true);
  });

  it('rejects unsupported query params and invalid page values', async () => {
    const mod = await import('./route');
    const res = await mod.GET(new Request('http://localhost/api/logs?level=error&page=0'));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('validation_error');
    expect(json.error.fields.level).toBeTruthy();
    expect(json.error.fields.page).toBeTruthy();
  });

  it('clears all logs', async () => {
    clearSystemLogsMock.mockResolvedValue({ deletedCount: 42 });

    const mod = await import('./route');
    const res = await mod.DELETE(new Request('http://localhost/api/logs', { method: 'DELETE' }));
    const json = await res.json();

    expect(clearSystemLogsMock).toHaveBeenCalledWith(pool);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({ deletedCount: 42 });
  });
});
