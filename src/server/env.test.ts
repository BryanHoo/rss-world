import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('env', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});

