import { describe, expect, it } from 'vitest';
import { getFetchUrlCandidates } from './fetchUrlCandidates';

describe('getFetchUrlCandidates', () => {
  it('returns input only for public urls', () => {
    expect(getFetchUrlCandidates('https://example.com/feed.xml')).toEqual([
      'https://example.com/feed.xml',
    ]);
  });

  it('adds host.docker.internal fallback for localhost', () => {
    expect(getFetchUrlCandidates('http://localhost:1200/path?x=1')).toEqual([
      'http://localhost:1200/path?x=1',
      'http://host.docker.internal:1200/path?x=1',
    ]);
  });

  it('adds host.docker.internal fallback for loopback ip', () => {
    expect(getFetchUrlCandidates('http://127.0.0.1:1200/feed')).toEqual([
      'http://127.0.0.1:1200/feed',
      'http://host.docker.internal:1200/feed',
    ]);
  });
});

