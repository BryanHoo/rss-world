import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUiSettingsMock = vi.fn();
const deleteExpiredSystemLogsMock = vi.fn();

vi.mock('../server/repositories/settingsRepo', () => ({
  getUiSettings: (...args: unknown[]) => getUiSettingsMock(...args),
}));

vi.mock('../server/repositories/systemLogsRepo', () => ({
  deleteExpiredSystemLogs: (...args: unknown[]) => deleteExpiredSystemLogsMock(...args),
}));

describe('systemLogCleanup', () => {
  beforeEach(() => {
    getUiSettingsMock.mockReset();
    deleteExpiredSystemLogsMock.mockReset();
  });

  it('cleans expired logs with the configured retentionDays', async () => {
    getUiSettingsMock.mockResolvedValue({ logging: { enabled: false, retentionDays: 30 } });

    const mod = await import('./systemLogCleanup');
    await mod.runSystemLogCleanup({ pool: {} as never });

    expect(deleteExpiredSystemLogsMock).toHaveBeenCalledWith(
      expect.anything(),
      { retentionDays: 30 },
    );
  });
});
