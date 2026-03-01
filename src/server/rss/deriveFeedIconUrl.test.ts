import { describe, expect, it } from 'vitest';
import { deriveFeedIconUrl } from './deriveFeedIconUrl';

describe('deriveFeedIconUrl', () => {
  it('returns google s2 favicon url from site origin', () => {
    expect(deriveFeedIconUrl('https://example.com/blog')).toBe(
      'https://www.google.com/s2/favicons?sz=64&domain_url=https%3A%2F%2Fexample.com',
    );
  });

  it('returns null for empty or invalid siteUrl', () => {
    expect(deriveFeedIconUrl(null)).toBeNull();
    expect(deriveFeedIconUrl(undefined)).toBeNull();
    expect(deriveFeedIconUrl('')).toBeNull();
    expect(deriveFeedIconUrl('not-a-url')).toBeNull();
  });
});
