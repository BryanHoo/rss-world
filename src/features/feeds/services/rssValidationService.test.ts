import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateRssUrl } from './rssValidationService';

describe('validateRssUrl', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns ok=true for success urls', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, kind: 'rss', title: 'Example' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await validateRssUrl('https://example.com/success.xml');
    expect(result.ok).toBe(true);
    expect(result.kind).toBe('rss');
  });

  it('maps 401/403/timeout/not-feed to deterministic error codes', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, errorCode: 'unauthorized' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, errorCode: 'unauthorized' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, errorCode: 'timeout' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, errorCode: 'not_feed' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    await expect(validateRssUrl('https://example.com/401.xml')).resolves.toMatchObject({ ok: false, errorCode: 'unauthorized' });
    await expect(validateRssUrl('https://example.com/403.xml')).resolves.toMatchObject({ ok: false, errorCode: 'unauthorized' });
    await expect(validateRssUrl('https://example.com/timeout.xml')).resolves.toMatchObject({ ok: false, errorCode: 'timeout' });
    await expect(validateRssUrl('https://example.com/invalid.xml')).resolves.toMatchObject({ ok: false, errorCode: 'not_feed' });
  });

  it('rejects invalid protocol', async () => {
    const result = await validateRssUrl('ftp://example.com/feed.xml');
    expect(result).toMatchObject({ ok: false, errorCode: 'invalid_url' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
