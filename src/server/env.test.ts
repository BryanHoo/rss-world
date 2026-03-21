import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('env', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('ignores AI_API_KEY from env input', () => {
    const env = parseEnv({ DATABASE_URL: 'postgres://example', AI_API_KEY: 'sk-test' });

    expect(Object.prototype.hasOwnProperty.call(env, 'AI_API_KEY')).toBe(false);
  });

  it('treats empty IMAGE_PROXY_SECRET as undefined', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgres://example',
      IMAGE_PROXY_SECRET: '',
    });

    expect(env.IMAGE_PROXY_SECRET).toBeUndefined();
  });

  it('parses IMAGE_PROXY_SECRET when provided', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgres://example',
      IMAGE_PROXY_SECRET: 'test-image-proxy-secret',
    });

    expect(env.IMAGE_PROXY_SECRET).toBe('test-image-proxy-secret');
  });
});
