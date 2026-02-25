import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from './settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
          return new Response(JSON.stringify({ ok: true, data: body }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true, data: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
  });

  it('does not persist apiKey into localStorage payload', async () => {
    useSettingsStore.getState().loadDraft();
    useSettingsStore.getState().updateDraft((draft) => {
      draft.session.ai.apiKey = 'sk-test';
    });
    await useSettingsStore.getState().saveDraft();

    const raw = window.localStorage.getItem('feedfuse-settings');
    expect(raw).not.toContain('sk-test');
  });

  it('saves draft with rss sources without requiring per-row verification state', async () => {
    useSettingsStore.getState().loadDraft();
    useSettingsStore.getState().updateDraft((draft) => {
      draft.persisted.rss.sources = [
        {
          id: 'source-1',
          name: 'Tech Feed',
          url: 'https://example.com/rss.xml',
          category: null,
          enabled: true,
        },
      ];
    });

    const result = await useSettingsStore.getState().saveDraft();
    expect(result.ok).toBe(true);
    expect(useSettingsStore.getState().persistedSettings.rss.sources).toHaveLength(1);
  });
});
