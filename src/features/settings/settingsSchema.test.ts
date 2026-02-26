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
    expect(Object.hasOwn(normalized, 'shortcuts')).toBe(false);
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

  it('normalizes categories and maps legacy rss source category/folder names', () => {
    const normalized = normalizePersistedSettings({
      categories: [{ id: 'cat-tech', name: '科技' }],
      rss: {
        sources: [
          { id: '1', name: 'A', url: 'https://example.com/rss.xml', category: '科技', enabled: true },
          { id: '2', name: 'B', url: 'https://example.com/rss2.xml', folder: '设计', enabled: true },
        ],
      },
    });

    expect(normalized.categories.length).toBeGreaterThanOrEqual(2);
    expect(normalized.categories.some((c) => c.name === '科技')).toBe(true);
    expect(normalized.categories.some((c) => c.name === '设计')).toBe(true);
  });

  it('supports rss.fullTextOnOpenEnabled', () => {
    const normalized = normalizePersistedSettings({
      rss: { fullTextOnOpenEnabled: true },
    });
    expect(normalized.rss.fullTextOnOpenEnabled).toBe(true);
  });
});
