import { beforeEach, describe, expect, it, vi } from 'vitest';

type AppStoreModule = typeof import('./appStore');
let useAppStore: AppStoreModule['useAppStore'];
let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  vi.resetModules();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  ({ useAppStore } = await import('./appStore'));
});

describe('appStore api integration', () => {
  it('loads snapshot into store', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/reader/snapshot')) {
        return jsonResponse({
          ok: true,
          data: {
            categories: [{ id: 'cat-tech', name: '科技', position: 0 }],
            feeds: [
              {
                id: 'feed-1',
                title: 'Example',
                url: 'https://example.com/rss.xml',
                siteUrl: null,
                iconUrl: null,
                enabled: true,
                fullTextOnOpenEnabled: false,
                aiSummaryOnOpenEnabled: false,
                categoryId: 'cat-tech',
                fetchIntervalMinutes: 30,
                unreadCount: 1,
              },
            ],
            articles: {
              items: [
                {
                  id: 'art-1',
                  feedId: 'feed-1',
                  title: 'Hello',
                  summary: 'Summary',
                  author: null,
                  publishedAt: '2026-02-25T00:00:00.000Z',
                  link: 'https://example.com/hello',
                  isRead: false,
                  isStarred: false,
                },
              ],
              nextCursor: null,
            },
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    await useAppStore.getState().loadSnapshot({ view: 'all' });

    expect(useAppStore.getState().categories.some((c) => c.id === 'cat-uncategorized')).toBe(true);
    expect(useAppStore.getState().categories.some((c) => c.id === 'cat-tech')).toBe(true);
    expect(useAppStore.getState().feeds[0].category).toBe('科技');
    expect(useAppStore.getState().articles[0].content).toBe('');
  });

  it('optimistically marks article as read and updates unreadCount', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/api/reader/snapshot')) {
        return jsonResponse({
          ok: true,
          data: {
            categories: [{ id: 'cat-tech', name: '科技', position: 0 }],
            feeds: [
              {
                id: 'feed-1',
                title: 'Example',
                url: 'https://example.com/rss.xml',
                siteUrl: null,
                iconUrl: null,
                enabled: true,
                fullTextOnOpenEnabled: false,
                aiSummaryOnOpenEnabled: false,
                categoryId: 'cat-tech',
                fetchIntervalMinutes: 30,
                unreadCount: 1,
              },
            ],
            articles: {
              items: [
                {
                  id: 'art-1',
                  feedId: 'feed-1',
                  title: 'Hello',
                  summary: 'Summary',
                  author: null,
                  publishedAt: '2026-02-25T00:00:00.000Z',
                  link: 'https://example.com/hello',
                  isRead: false,
                  isStarred: false,
                },
              ],
              nextCursor: null,
            },
          },
        });
      }

      if (url.includes('/api/articles/art-1') && method === 'PATCH') {
        return jsonResponse({ ok: true, data: { updated: true } });
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    await useAppStore.getState().loadSnapshot({ view: 'all' });

    useAppStore.getState().markAsRead('art-1');

    expect(useAppStore.getState().articles[0].isRead).toBe(true);
    expect(useAppStore.getState().feeds[0].unreadCount).toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/articles/art-1'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('creates feed via API, stores it, and selects it', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/api/feeds') && method === 'POST') {
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
        return jsonResponse({
          ok: true,
          data: {
            id: 'feed-new',
            title: String(body.title ?? ''),
            url: String(body.url ?? ''),
            siteUrl: null,
            iconUrl: null,
            enabled: true,
            fullTextOnOpenEnabled: Boolean(body.fullTextOnOpenEnabled ?? false),
            aiSummaryOnOpenEnabled: Boolean(body.aiSummaryOnOpenEnabled ?? false),
            categoryId: body.categoryId ?? null,
            fetchIntervalMinutes: 30,
            unreadCount: 0,
          },
        });
      }

      if (url.includes('/api/feeds/feed-new/refresh') && method === 'POST') {
        return jsonResponse({ ok: true, data: { enqueued: true, jobId: 'job-1' } });
      }

      if (url.includes('/api/reader/snapshot') && method === 'GET') {
        const view = new URL(url).searchParams.get('view');
        if (view === 'feed-new') {
          return jsonResponse({
            ok: true,
            data: {
              categories: [],
              feeds: [
                {
                  id: 'feed-new',
                  title: 'New Feed',
                  url: 'https://example.com/new.xml',
                  siteUrl: null,
                  iconUrl: null,
                  enabled: true,
                  fullTextOnOpenEnabled: false,
                  aiSummaryOnOpenEnabled: false,
                  categoryId: null,
                  fetchIntervalMinutes: 30,
                  unreadCount: 1,
                },
              ],
              articles: {
                items: [
                  {
                    id: 'art-new',
                    feedId: 'feed-new',
                    title: 'Fresh Article',
                    summary: 'Summary',
                    author: null,
                    publishedAt: '2026-02-25T00:00:00.000Z',
                    link: 'https://example.com/fresh',
                    isRead: false,
                    isStarred: false,
                  },
                ],
                nextCursor: null,
              },
            },
          });
        }
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    useAppStore.getState().addFeed({
      title: 'New Feed',
      url: 'https://example.com/new.xml',
      categoryId: null,
    });

    await flushPromises();

    const added = useAppStore.getState().feeds.find((feed) => feed.id === 'feed-new');
    expect(added).toBeTruthy();
    expect(useAppStore.getState().selectedView).toBe('feed-new');
  });

  it('polls selected feed snapshot after addFeed so new articles appear without reselecting', async () => {
    let feedSnapshotCalls = 0;

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/api/feeds') && method === 'POST') {
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
        return jsonResponse({
          ok: true,
          data: {
            id: 'feed-new',
            title: String(body.title ?? ''),
            url: String(body.url ?? ''),
            siteUrl: null,
            iconUrl: null,
            enabled: true,
            fullTextOnOpenEnabled: false,
            aiSummaryOnOpenEnabled: false,
            categoryId: null,
            fetchIntervalMinutes: 30,
            unreadCount: 0,
          },
        });
      }

      if (url.includes('/api/feeds/feed-new/refresh') && method === 'POST') {
        return jsonResponse({ ok: true, data: { enqueued: true, jobId: 'job-1' } });
      }

      if (url.includes('/api/reader/snapshot') && method === 'GET') {
        const view = new URL(url).searchParams.get('view');
        if (view === 'feed-new') {
          feedSnapshotCalls += 1;
          const hasArticles = feedSnapshotCalls >= 2;

          return jsonResponse({
            ok: true,
            data: {
              categories: [],
              feeds: [
                {
                  id: 'feed-new',
                  title: 'New Feed',
                  url: 'https://example.com/new.xml',
                  siteUrl: null,
                  iconUrl: null,
                  enabled: true,
                  fullTextOnOpenEnabled: false,
                  aiSummaryOnOpenEnabled: false,
                  categoryId: null,
                  fetchIntervalMinutes: 30,
                  unreadCount: hasArticles ? 1 : 0,
                },
              ],
              articles: {
                items: hasArticles
                  ? [
                      {
                        id: 'art-new-1',
                        feedId: 'feed-new',
                        title: 'Fresh Article',
                        summary: 'Summary',
                        author: null,
                        publishedAt: '2026-02-25T00:00:00.000Z',
                        link: 'https://example.com/fresh-article',
                        isRead: false,
                        isStarred: false,
                      },
                    ]
                  : [],
                nextCursor: null,
              },
            },
          });
        }
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    useAppStore.getState().addFeed({
      title: 'New Feed',
      url: 'https://example.com/new.xml',
      categoryId: null,
    });

    await vi.waitFor(() => {
      expect(useAppStore.getState().selectedView).toBe('feed-new');
      expect(useAppStore.getState().articles.some((item) => item.feedId === 'feed-new')).toBe(true);
    }, { timeout: 5000 });

    expect(feedSnapshotCalls).toBeGreaterThanOrEqual(2);
  });

  it('rejects when addFeed create request fails', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/api/feeds') && method === 'POST') {
        return jsonResponse(
          {
            ok: false,
            error: {
              code: 'conflict',
              message: 'feed existed',
            },
          },
          { status: 409 },
        );
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    const result = useAppStore.getState().addFeed({
      title: 'Duplicated Feed',
      url: 'https://example.com/dup.xml',
      categoryId: null,
    });

    await expect(Promise.resolve(result)).rejects.toThrow();
  });

  it('updateFeed updates url and icon in store while keeping unreadCount', async () => {
    useAppStore.setState({
      categories: [],
      feeds: [
        {
          id: 'feed-1',
          title: 'Old Title',
          url: 'https://old.example.com/rss.xml',
          icon: undefined,
          unreadCount: 7,
          enabled: true,
          fullTextOnOpenEnabled: false,
          aiSummaryOnOpenEnabled: false,
          categoryId: null,
          category: null,
        },
      ],
    });

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/api/feeds/feed-1') && method === 'PATCH') {
        return jsonResponse({
          ok: true,
          data: {
            id: 'feed-1',
            title: 'New Title',
            url: 'https://new.example.com/rss.xml',
            siteUrl: 'https://new.example.com/',
            iconUrl:
              'https://www.google.com/s2/favicons?sz=64&domain_url=https%3A%2F%2Fnew.example.com',
            enabled: true,
            fullTextOnOpenEnabled: false,
            aiSummaryOnOpenEnabled: false,
            categoryId: null,
            fetchIntervalMinutes: 30,
          },
        });
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });

    await useAppStore.getState().updateFeed('feed-1', {
      title: 'New Title',
      url: 'https://new.example.com/rss.xml',
      siteUrl: 'https://new.example.com/',
    });

    const updated = useAppStore.getState().feeds.find((feed) => feed.id === 'feed-1');
    expect(updated?.url).toBe('https://new.example.com/rss.xml');
    expect(updated?.icon).toBe(
      'https://www.google.com/s2/favicons?sz=64&domain_url=https%3A%2F%2Fnew.example.com',
    );
    expect(updated?.unreadCount).toBe(7);
  });
});
