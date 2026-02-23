import { describe, expect, it } from 'vitest';
import { validateSettingsDraft } from './validateSettingsDraft';

describe('validateSettingsDraft', () => {
  it('rejects non-http rss url and duplicate shortcut bindings', () => {
    const result = validateSettingsDraft({
      persisted: {
        shortcuts: {
          enabled: true,
          bindings: {
            nextArticle: 'j',
            prevArticle: 'j',
            toggleStar: 's',
            markRead: 'm',
            openOriginal: 'v',
          },
        },
        rss: { sources: [{ id: '1', name: 'A', url: 'ftp://bad', folder: null, enabled: true }] },
      },
    } as any);

    expect(result.valid).toBe(false);
    expect(result.errors['rss.sources.0.url']).toBeTruthy();
    expect(result.errors['shortcuts.bindings']).toBeTruthy();
  });
});
