import { describe, expect, it, vi } from 'vitest';

function getFetchUrl(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg && typeof arg === 'object' && 'url' in arg) {
    const url = (arg as { url?: unknown }).url;
    if (typeof url === 'string') return url;
  }
  return '';
}

describe('translateTitle', () => {
  it('calls chat/completions and returns content', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '你好世界' } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { translateTitle } = await import('./translateTitle');
    const out = await translateTitle({
      apiBaseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      title: 'Hello world',
    });

    expect(out).toBe('你好世界');
    expect(getFetchUrl(fetchMock.mock.calls[0]?.[0])).toBe('https://api.openai.com/v1/chat/completions');
  });
});

