import { beforeEach, describe, expect, it, vi } from 'vitest';

const listSystemLogsRepoMock = vi.fn();

vi.mock('../repositories/systemLogsRepo', () => ({
  listSystemLogs: (...args: unknown[]) => listSystemLogsRepoMock(...args),
}));

describe('systemLogsService', () => {
  beforeEach(() => {
    listSystemLogsRepoMock.mockReset();
  });

  it('encodes opaque cursors and maps repo items into API data', async () => {
    listSystemLogsRepoMock.mockResolvedValue({
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
      hasMore: true,
    });

    const mod = (await import('./systemLogsService')) as typeof import('./systemLogsService');
    const result = await mod.getSystemLogs({} as never, {
      level: 'error',
      limit: 50,
      before: null,
    });

    expect(listSystemLogsRepoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ level: 'error', before: null, limit: 50 }),
    );
    expect(result).toEqual({
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
      nextCursor: mod.encodeSystemLogCursor({
        createdAt: '2026-03-19T10:12:30.000Z',
        id: '128',
      }),
      hasMore: true,
    });
  });

  it('rejects invalid before cursors', async () => {
    const mod = (await import('./systemLogsService')) as typeof import('./systemLogsService');

    await expect(
      mod.getSystemLogs({} as never, { before: 'not-a-cursor' }),
    ).rejects.toMatchObject({
      code: 'validation_error',
      fields: { before: expect.any(String) },
    });
  });

  it('clamps limit to a safe range before querying the repository', async () => {
    listSystemLogsRepoMock.mockResolvedValue({ items: [], hasMore: false });

    const mod = (await import('./systemLogsService')) as typeof import('./systemLogsService');
    await mod.getSystemLogs({} as never, { limit: 999 });

    expect(listSystemLogsRepoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 200 }),
    );
  });
});
