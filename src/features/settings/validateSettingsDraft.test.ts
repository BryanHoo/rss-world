import { describe, expect, it } from 'vitest';
import { validateSettingsDraft, type SettingsDraft } from './validateSettingsDraft';
import { defaultPersistedSettings } from './settingsSchema';

describe('validateSettingsDraft', () => {
  it('rejects non-http rss url', () => {
    const draft: SettingsDraft = {
      persisted: {
        ...structuredClone(defaultPersistedSettings),
        rss: {
          sources: [{ id: '1', name: 'A', url: 'ftp://bad', folder: null, enabled: true }],
        },
      },
      session: { ai: { apiKey: '' } },
    };

    const result = validateSettingsDraft(draft);

    expect(result.valid).toBe(false);
    expect(result.errors['rss.sources.0.url']).toBeTruthy();
  });
});
