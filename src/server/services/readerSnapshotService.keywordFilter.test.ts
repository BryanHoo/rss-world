import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

const listCategoriesMock = vi.fn();
const listFeedsMock = vi.fn();
const getUiSettingsMock = vi.fn();

vi.mock('../repositories/categoriesRepo', () => ({
  listCategories: (...args: unknown[]) => listCategoriesMock(...args),
}));
vi.mock('../repositories/feedsRepo', () => ({
  listFeeds: (...args: unknown[]) => listFeedsMock(...args),
}));
vi.mock('../repositories/settingsRepo', () => ({
  getUiSettings: (...args: unknown[]) => getUiSettingsMock(...args),
}));

describe('readerSnapshotService (keyword filter)', () => {
  it('hides articles matched by global keywords', async () => {
    listCategoriesMock.mockResolvedValue([]);
    listFeedsMock.mockResolvedValue([]);
    getUiSettingsMock.mockResolvedValue({
      rss: { articleKeywordFilter: { globalKeywords: ['Sponsored'], feedKeywordsByFeedId: {} } },
    });

    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'a-1',
            feedId: 'feed-1',
            title: 'Sponsored Post',
            summary: 'Weekly',
            sortPublishedAt: '2026-03-01T00:00:00.000Z',
            publishedAt: '2026-03-01T00:00:00.000Z',
            author: null,
            link: null,
            previewImage: null,
            titleOriginal: null,
            titleZh: null,
            isRead: false,
            isStarred: false,
            sourceLanguage: 'en',
            contentHtml: null,
            contentFullHtml: null,
          },
          {
            id: 'a-2',
            feedId: 'feed-1',
            title: 'Real Story',
            summary: 'Useful',
            sortPublishedAt: '2026-02-28T00:00:00.000Z',
            publishedAt: '2026-02-28T00:00:00.000Z',
            author: null,
            link: null,
            previewImage: null,
            titleOriginal: null,
            titleZh: null,
            isRead: false,
            isStarred: false,
            sourceLanguage: 'en',
            contentHtml: null,
            contentFullHtml: null,
          },
        ],
      });

    const pool = { query } as unknown as Pool;
    const mod = await import('./readerSnapshotService');
    const snapshot = await mod.getReaderSnapshot(pool, { view: 'all', limit: 10 });

    expect(snapshot.articles.items.map((item) => item.id)).toEqual(['a-2']);
  });


  it('keeps pagination based on visible articles after filtering', async () => {
    listCategoriesMock.mockResolvedValue([]);
    listFeedsMock.mockResolvedValue([]);
    getUiSettingsMock.mockResolvedValue({
      rss: { articleKeywordFilter: { globalKeywords: ['Sponsored'], feedKeywordsByFeedId: {} } },
    });

    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'a-1',
            feedId: 'feed-1',
            title: 'Sponsored Post',
            summary: 'Weekly',
            sortPublishedAt: '2026-03-01T00:00:00.000Z',
            publishedAt: '2026-03-01T00:00:00.000Z',
            author: null,
            link: null,
            previewImage: null,
            titleOriginal: null,
            titleZh: null,
            isRead: false,
            isStarred: false,
            sourceLanguage: 'en',
            contentHtml: null,
            contentFullHtml: null,
          },
          {
            id: 'a-2',
            feedId: 'feed-1',
            title: 'Real Story',
            summary: 'Useful',
            sortPublishedAt: '2026-02-28T00:00:00.000Z',
            publishedAt: '2026-02-28T00:00:00.000Z',
            author: null,
            link: null,
            previewImage: null,
            titleOriginal: null,
            titleZh: null,
            isRead: false,
            isStarred: false,
            sourceLanguage: 'en',
            contentHtml: null,
            contentFullHtml: null,
          },
          {
            id: 'a-3',
            feedId: 'feed-1',
            title: 'Another Story',
            summary: 'Useful',
            sortPublishedAt: '2026-02-27T00:00:00.000Z',
            publishedAt: '2026-02-27T00:00:00.000Z',
            author: null,
            link: null,
            previewImage: null,
            titleOriginal: null,
            titleZh: null,
            isRead: false,
            isStarred: false,
            sourceLanguage: 'en',
            contentHtml: null,
            contentFullHtml: null,
          },
        ],
      });

    const pool = { query } as unknown as Pool;
    const mod = await import('./readerSnapshotService');
    const snapshot = await mod.getReaderSnapshot(pool, { view: 'all', limit: 1 });

    expect(snapshot.articles.items.map((item) => item.id)).toEqual(['a-2']);
    expect(snapshot.articles.nextCursor).toBe(
      mod.encodeCursor({ publishedAt: '2026-02-27T00:00:00.000Z', id: 'a-3' }),
    );
  });
});
