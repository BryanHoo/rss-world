import { beforeEach, describe, expect, it, vi } from 'vitest';

const listSystemLogsRepoMock = vi.fn();
const deleteAllSystemLogsRepoMock = vi.fn();

vi.mock('../repositories/systemLogsRepo', () => ({
  listSystemLogs: (...args: unknown[]) => listSystemLogsRepoMock(...args),
  deleteAllSystemLogs: (...args: unknown[]) => deleteAllSystemLogsRepoMock(...args),
}));

describe('systemLogsService', () => {
  beforeEach(() => {
    listSystemLogsRepoMock.mockReset();
    deleteAllSystemLogsRepoMock.mockReset();
  });

  it('maps page response without cursor fields', async () => {
    listSystemLogsRepoMock.mockResolvedValue({
      items: [],
      total: 42,
    });

    const mod = (await import('./systemLogsService')) as typeof import('./systemLogsService');
    const result = await mod.getSystemLogs({} as never, {
      keyword: 'summary',
      page: 2,
      pageSize: 20,
    });

    expect(listSystemLogsRepoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ keyword: 'summary', page: 2, pageSize: 20 }),
    );
    expect(result).toEqual({
      items: [],
      page: 2,
      pageSize: 20,
      total: 42,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it('normalizes keyword, page and pageSize before querying the repository', async () => {
    listSystemLogsRepoMock.mockResolvedValue({ items: [], total: 0 });

    const mod = (await import('./systemLogsService')) as typeof import('./systemLogsService');
    await mod.getSystemLogs({} as never, {
      keyword: '  summary  ',
      page: 0,
      pageSize: 999,
    });

    expect(listSystemLogsRepoMock).toHaveBeenCalledWith(expect.anything(), {
      keyword: 'summary',
      page: 1,
      pageSize: 100,
    });
  });

  it('clears all logs and returns deletedCount', async () => {
    deleteAllSystemLogsRepoMock.mockResolvedValue(12);

    const mod = (await import('./systemLogsService')) as typeof import('./systemLogsService');
    const result = await mod.clearSystemLogs({} as never);

    expect(deleteAllSystemLogsRepoMock).toHaveBeenCalledWith(expect.anything());
    expect(result).toEqual({ deletedCount: 12 });
  });
});
