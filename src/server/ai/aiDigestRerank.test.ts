import { describe, expect, it, vi } from 'vitest';

function getFetchUrl(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg && typeof arg === 'object' && 'url' in arg) {
    const url = (arg as { url?: unknown }).url;
    if (typeof url === 'string') return url;
  }
  return '';
}

describe('aiDigestRerank', () => {
  it('calls chat/completions and parses JSON array ids', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '```json\n["a1","a2"]\n```' } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { aiDigestRerank } = await import('./aiDigestRerank');
    const out = await aiDigestRerank({
      apiBaseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      prompt: '解读这些文章',
      topN: 2,
      shortlist: [],
      batch: [
        {
          id: 'a1',
          feedTitle: 'Feed 1',
          title: 'Title 1',
          summary: null,
          link: null,
          fetchedAt: '2026-03-14T00:00:00.000Z',
        },
        {
          id: 'a2',
          feedTitle: 'Feed 2',
          title: 'Title 2',
          summary: null,
          link: null,
          fetchedAt: '2026-03-14T00:00:00.000Z',
        },
      ],
    });

    expect(out).toEqual(['a1', 'a2']);
    expect(fetchMock).toHaveBeenCalled();
    expect(getFetchUrl(fetchMock.mock.calls[0]?.[0])).toBe('https://api.openai.com/v1/chat/completions');
  });
});
