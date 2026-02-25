import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';

const pool = {};

const getAiApiKeyMock = vi.fn();
const setAiApiKeyMock = vi.fn();
const clearAiApiKeyMock = vi.fn();

vi.mock('../../../../../server/db/pool', () => ({
  getPool: () => pool,
}));
vi.mock('../../../../../../server/db/pool', () => ({
  getPool: () => pool,
}));

vi.mock('../../../../../server/repositories/settingsRepo', () => ({
  getAiApiKey: (...args: unknown[]) => getAiApiKeyMock(...args),
  setAiApiKey: (...args: unknown[]) => setAiApiKeyMock(...args),
  clearAiApiKey: (...args: unknown[]) => clearAiApiKeyMock(...args),
}));
vi.mock('../../../../../../server/repositories/settingsRepo', () => ({
  getAiApiKey: (...args: unknown[]) => getAiApiKeyMock(...args),
  setAiApiKey: (...args: unknown[]) => setAiApiKeyMock(...args),
  clearAiApiKey: (...args: unknown[]) => clearAiApiKeyMock(...args),
}));

const routeFilePath = 'src/app/api/settings/ai/api-key/route.ts';

describe('/api/settings/ai/api-key', () => {
  beforeEach(() => {
    getAiApiKeyMock.mockReset();
    setAiApiKeyMock.mockReset();
    clearAiApiKeyMock.mockReset();
  });

  it('route module exists', () => {
    expect(existsSync(routeFilePath)).toBe(true);
  });

  it('GET returns hasApiKey status', async () => {
    if (!existsSync(routeFilePath)) {
      expect.fail('route.ts missing');
    }

    getAiApiKeyMock.mockResolvedValue('sk-test');

    const routeModuleSpecifier = './route';
    const mod = await import(/* @vite-ignore */ routeModuleSpecifier);
    const res = await mod.GET();
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.data.hasApiKey).toBe(true);
  });

  it('PUT stores apiKey and returns hasApiKey true', async () => {
    if (!existsSync(routeFilePath)) {
      expect.fail('route.ts missing');
    }

    setAiApiKeyMock.mockResolvedValue('sk-test');

    const routeModuleSpecifier = './route';
    const mod = await import(/* @vite-ignore */ routeModuleSpecifier);
    const res = await mod.PUT(
      new Request('http://localhost/api/settings/ai/api-key', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey: 'sk-test' }),
      }),
    );
    const json = await res.json();

    expect(setAiApiKeyMock).toHaveBeenCalledWith(pool, 'sk-test');
    expect(json.ok).toBe(true);
    expect(json.data.hasApiKey).toBe(true);
  });

  it('DELETE clears apiKey and returns hasApiKey false', async () => {
    if (!existsSync(routeFilePath)) {
      expect.fail('route.ts missing');
    }

    clearAiApiKeyMock.mockResolvedValue('');

    const routeModuleSpecifier = './route';
    const mod = await import(/* @vite-ignore */ routeModuleSpecifier);
    const res = await mod.DELETE();
    const json = await res.json();

    expect(clearAiApiKeyMock).toHaveBeenCalledWith(pool);
    expect(json.ok).toBe(true);
    expect(json.data.hasApiKey).toBe(false);
  });
});
