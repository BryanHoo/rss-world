import { describe, expect, it, vi } from 'vitest';

function getFetchUrl(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg && typeof arg === 'object' && 'url' in arg) {
    const url = (arg as { url?: unknown }).url;
    if (typeof url === 'string') return url;
  }
  return '';
}

describe('translateHtml', () => {
  it('calls chat/completions and returns content', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '<p>你好</p>' } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { translateHtml } = await import('./translateHtml');
    const out = await translateHtml({
      apiBaseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      html: '<p>Hello</p>',
    });

    expect(out).toContain('你好');
    expect(fetchMock).toHaveBeenCalled();
    expect(getFetchUrl(fetchMock.mock.calls[0]?.[0])).toBe('https://api.openai.com/v1/chat/completions');
  });
});
