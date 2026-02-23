import { describe, expect, it } from 'vitest';
import { normalizePersistedSettings } from './settingsSchema';

describe('settingsSchema normalize', () => {
  it('maps legacy flat settings to appearance namespace', () => {
    const normalized = normalizePersistedSettings({
      theme: 'dark',
      fontSize: 'large',
      fontFamily: 'serif',
      lineHeight: 'relaxed',
    });

    expect(normalized.appearance.theme).toBe('dark');
    expect(normalized.appearance.fontSize).toBe('large');
    expect(normalized.ai.provider).toBe('openai-compatible');
  });
});
