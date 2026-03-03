import { describe, expect, it } from 'vitest';

describe('openaiClient', () => {
  it('normalizes baseURL by trimming trailing slash only', async () => {
    const mod = await import('./openaiClient');
    expect(mod.normalizeBaseUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1');
    expect(mod.normalizeBaseUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1');
  });
});

