import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';

const pool = {};

const getAiApiKeyMock = vi.fn();
const getTranslationApiKeyMock = vi.fn();
const getUiSettingsMock = vi.fn();
const setTranslationApiKeyMock = vi.fn();
const clearTranslationApiKeyMock = vi.fn();
const cleanupAiRuntimeStateMock = vi.fn();

vi.mock('../../../../../server/db/pool', () => ({
  getPool: () => pool,
}));
vi.mock('../../../../../../server/db/pool', () => ({
  getPool: () => pool,
}));

vi.mock('../../../../../server/repositories/settingsRepo', () => ({
  getAiApiKey: (...args: unknown[]) => getAiApiKeyMock(...args),
  getTranslationApiKey: (...args: unknown[]) => getTranslationApiKeyMock(...args),
  getUiSettings: (...args: unknown[]) => getUiSettingsMock(...args),
  setTranslationApiKey: (...args: unknown[]) => setTranslationApiKeyMock(...args),
  clearTranslationApiKey: (...args: unknown[]) => clearTranslationApiKeyMock(...args),
}));
vi.mock('../../../../../../server/repositories/settingsRepo', () => ({
  getAiApiKey: (...args: unknown[]) => getAiApiKeyMock(...args),
  getTranslationApiKey: (...args: unknown[]) => getTranslationApiKeyMock(...args),
  getUiSettings: (...args: unknown[]) => getUiSettingsMock(...args),
  setTranslationApiKey: (...args: unknown[]) => setTranslationApiKeyMock(...args),
  clearTranslationApiKey: (...args: unknown[]) => clearTranslationApiKeyMock(...args),
}));

vi.mock('../../../../../server/ai/cleanupAiRuntimeState', () => ({
  cleanupAiRuntimeState: (...args: unknown[]) => cleanupAiRuntimeStateMock(...args),
}));
vi.mock('../../../../../../server/ai/cleanupAiRuntimeState', () => ({
  cleanupAiRuntimeState: (...args: unknown[]) => cleanupAiRuntimeStateMock(...args),
}));

const routeFilePath = 'src/app/api/settings/translation/api-key/route.ts';

describe('/api/settings/translation/api-key', () => {
  beforeEach(() => {
    getAiApiKeyMock.mockReset().mockResolvedValue('sk-shared');
    getTranslationApiKeyMock.mockReset().mockResolvedValue('sk-translation-old');
    getUiSettingsMock.mockReset().mockResolvedValue({
      ai: {
        model: 'gpt-4o-mini',
        apiBaseUrl: 'https://ai.example.com/v1',
        translation: {
          useSharedAi: false,
          model: 'gpt-translation',
          apiBaseUrl: 'https://translation.example.com/v1',
        },
      },
    });
    setTranslationApiKeyMock.mockReset();
    clearTranslationApiKeyMock.mockReset();
    cleanupAiRuntimeStateMock.mockReset().mockResolvedValue({
      summarySessions: 0,
      translationSessions: 0,
      digestRuns: 0,
      taskRows: 0,
    });
  });

  it('route module exists', () => {
    expect(existsSync(routeFilePath)).toBe(true);
  });

  it('PUT cleans only translation tasks when dedicated translation config changes', async () => {
    setTranslationApiKeyMock.mockResolvedValue('sk-translation-new');

    const mod = await import('./route');
    const res = await mod.PUT(
      new Request('http://localhost/api/settings/translation/api-key', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey: 'sk-translation-new' }),
      }),
    );
    const json = await res.json();

    expect(setTranslationApiKeyMock).toHaveBeenCalledWith(pool, 'sk-translation-new');
    expect(cleanupAiRuntimeStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pool,
        scopes: {
          summary: false,
          translation: true,
          digest: false,
        },
      }),
    );
    expect(json.ok).toBe(true);
    expect(json.data.hasApiKey).toBe(true);
  });

  it('PUT does not clean tasks when shared AI is still enabled', async () => {
    getUiSettingsMock.mockResolvedValue({
      ai: {
        model: 'gpt-4o-mini',
        apiBaseUrl: 'https://ai.example.com/v1',
        translation: {
          useSharedAi: true,
          model: '',
          apiBaseUrl: '',
        },
      },
    });
    setTranslationApiKeyMock.mockResolvedValue('sk-translation-new');

    const mod = await import('./route');
    await mod.PUT(
      new Request('http://localhost/api/settings/translation/api-key', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey: 'sk-translation-new' }),
      }),
    );

    expect(cleanupAiRuntimeStateMock).not.toHaveBeenCalled();
  });
});
