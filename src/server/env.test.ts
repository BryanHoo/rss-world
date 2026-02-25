import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('env', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('treats empty AI_API_KEY as undefined', () => {
    const env = parseEnv({ DATABASE_URL: 'postgres://example', AI_API_KEY: '' });
    expect(env.AI_API_KEY).toBeUndefined();
  });
});
