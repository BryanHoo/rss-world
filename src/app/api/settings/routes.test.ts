import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultPersistedSettings, normalizePersistedSettings } from '../../../features/settings/settingsSchema';

const pool = {};

const getUiSettingsMock = vi.fn();
const updateUiSettingsMock = vi.fn();

vi.mock('../../../server/db/pool', () => ({
  getPool: () => pool,
}));
vi.mock('../../../../server/db/pool', () => ({
  getPool: () => pool,
}));

vi.mock('../../../server/repositories/settingsRepo', () => ({
  getUiSettings: (...args: unknown[]) => getUiSettingsMock(...args),
  updateUiSettings: (...args: unknown[]) => updateUiSettingsMock(...args),
}));
vi.mock('../../../../server/repositories/settingsRepo', () => ({
  getUiSettings: (...args: unknown[]) => getUiSettingsMock(...args),
  updateUiSettings: (...args: unknown[]) => updateUiSettingsMock(...args),
}));

describe('/api/settings', () => {
  beforeEach(() => {
    getUiSettingsMock.mockReset();
    updateUiSettingsMock.mockReset();
  });

  it('GET returns normalized persisted settings', async () => {
    getUiSettingsMock.mockResolvedValue({ appearance: { theme: 'dark' } });

    const mod = await import('./route');
    const res = await mod.GET();
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.data.appearance.theme).toBe('dark');
    expect(json.data.ai).toEqual(defaultPersistedSettings.ai);
    expect(Array.isArray(json.data.categories)).toBe(true);
  });

  it('PUT normalizes and persists settings', async () => {
    const payload = { appearance: { theme: 'light' }, ai: { model: 'gpt-4o-mini' } };
    const normalized = normalizePersistedSettings(payload);
    updateUiSettingsMock.mockResolvedValue(normalized);

    const mod = await import('./route');
    const res = await mod.PUT(
      new Request('http://localhost/api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );
    const json = await res.json();

    expect(updateUiSettingsMock).toHaveBeenCalledWith(pool, normalized);
    expect(json.ok).toBe(true);
    expect(json.data.ai.model).toBe('gpt-4o-mini');
    expect(json.data.appearance.theme).toBe('light');
  });
});

