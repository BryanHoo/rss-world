import { describe, expect, it, vi } from 'vitest';

function getFetchUrl(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg && typeof arg === 'object' && 'url' in arg) {
    const url = (arg as { url?: unknown }).url;
    if (typeof url === 'string') return url;
  }
  return '';
}

describe('summarizeText', () => {
  it('calls chat/completions with a prompt that forbids TL;DR prefixes', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '一句话总结\n- 第一条' } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { summarizeText } = await import('./summarizeText');
    const out = await summarizeText({
      apiBaseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      text: 'hello',
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const requestBody =
      typeof requestInit?.body === 'string' ? JSON.parse(requestInit.body) : null;
    const systemPrompt = requestBody?.messages?.[0]?.content;

    expect(out).toBe('一句话总结\n- 第一条');
    expect(fetchMock).toHaveBeenCalled();
    expect(getFetchUrl(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.openai.com/v1/chat/completions',
    );
    expect(systemPrompt).toContain('不要返回');
    expect(systemPrompt).toContain('TL;DR');
    expect(systemPrompt).not.toContain('先给一行 TL;DR');
  });
});
