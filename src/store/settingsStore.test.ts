import { describe, expect, it } from 'vitest';
import { useSettingsStore } from './settingsStore';

describe('settingsStore', () => {
  it('does not persist apiKey into localStorage payload', () => {
    useSettingsStore.getState().loadDraft();
    useSettingsStore.getState().updateDraft((draft) => {
      draft.session.ai.apiKey = 'sk-test';
    });
    useSettingsStore.getState().saveDraft();

    const raw = window.localStorage.getItem('feedfuse-settings');
    expect(raw).not.toContain('sk-test');
  });

  it('saves draft with rss sources without requiring per-row verification state', () => {
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

    const result = useSettingsStore.getState().saveDraft();
    expect(result.ok).toBe(true);
    expect(useSettingsStore.getState().persistedSettings.rss.sources).toHaveLength(1);
  });
});
