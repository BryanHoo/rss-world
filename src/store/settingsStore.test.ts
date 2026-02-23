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
});
