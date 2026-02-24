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
});
