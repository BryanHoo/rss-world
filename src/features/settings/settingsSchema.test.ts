import { describe, expect, it } from 'vitest';
import { normalizePersistedSettings } from './settingsSchema';

describe('settingsSchema normalize', () => {
  it('maps legacy flat settings to appearance namespace and omits shortcuts settings', () => {
    const normalized = normalizePersistedSettings({
      theme: 'dark',
      fontSize: 'large',
      fontFamily: 'serif',
      lineHeight: 'relaxed',
    });

    expect(normalized.appearance.theme).toBe('dark');
    expect(normalized.appearance.fontSize).toBe('large');
    expect(normalized.ai.model).toBe('');
    expect((normalized as Record<string, unknown>).shortcuts).toBeUndefined();
  });

  it('maps legacy rss source folder to category', () => {
    const normalized = normalizePersistedSettings({
      rss: {
        sources: [
          {
            id: '1',
            name: 'Tech',
            url: 'https://example.com/rss.xml',
            folder: '科技',
            enabled: true,
          },
        ],
      },
    });

    expect(normalized.rss.sources[0].category).toBe('科技');
  });
});
