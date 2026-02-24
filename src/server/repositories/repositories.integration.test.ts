import { describe, expect, it } from 'vitest';
import { getPool } from '../db/pool';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from './categoriesRepo';
import { createFeed, deleteFeed, listFeeds, updateFeed } from './feedsRepo';
import {
  getArticleById,
  insertArticleIgnoreDuplicate,
  markAllRead,
  setArticleRead,
  setArticleStarred,
} from './articlesRepo';
import { getAppSettings, updateAppSettings } from './settingsRepo';

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)('repositories (integration)', () => {
  it('creates, updates and deletes categories', async () => {
    const pool = getPool();

    const created = await createCategory(pool, { name: 'Tech' });
    try {
      const categories = await listCategories(pool);
      expect(categories.some((c) => c.id === created.id)).toBe(true);

      const updated = await updateCategory(pool, created.id, { name: 'Tech 2' });
      expect(updated?.name).toBe('Tech 2');
    } finally {
      await deleteCategory(pool, created.id);
    }
  });

  it('creates, lists, updates and deletes feeds', async () => {
    const pool = getPool();

    const category = await createCategory(pool, { name: 'News' });
    try {
      const url = 'https://example.com/rss.xml';
      const created = await createFeed(pool, {
        title: 'Example',
        url,
        categoryId: category.id,
      });
      try {
        const feeds = await listFeeds(pool);
        expect(feeds.some((f) => f.id === created.id)).toBe(true);

        const updated = await updateFeed(pool, created.id, { enabled: false });
        expect(updated?.enabled).toBe(false);

        await expect(
          createFeed(pool, { title: 'Duplicate', url }),
        ).rejects.toBeTruthy();
      } finally {
        await deleteFeed(pool, created.id);
      }
    } finally {
      await deleteCategory(pool, category.id);
    }
  });

  it('inserts articles idempotently and updates read/star flags', async () => {
    const pool = getPool();

    const feed = await createFeed(pool, {
      title: 'Articles',
      url: 'https://example.com/articles.xml',
    });
    try {
      const first = await insertArticleIgnoreDuplicate(pool, {
        feedId: feed.id,
        dedupeKey: 'guid:1',
        title: 'Hello',
      });
      expect(first).not.toBeNull();

      const dup = await insertArticleIgnoreDuplicate(pool, {
        feedId: feed.id,
        dedupeKey: 'guid:1',
        title: 'Hello again',
      });
      expect(dup).toBeNull();

      await setArticleRead(pool, first!.id, true);
      await setArticleStarred(pool, first!.id, true);
      const after = await getArticleById(pool, first!.id);
      expect(after?.isRead).toBe(true);
      expect(after?.isStarred).toBe(true);

      const second = await insertArticleIgnoreDuplicate(pool, {
        feedId: feed.id,
        dedupeKey: 'guid:2',
        title: 'World',
      });
      expect(second).not.toBeNull();
      const changed = await markAllRead(pool, { feedId: feed.id });
      expect(changed).toBeGreaterThanOrEqual(1);
    } finally {
      await deleteFeed(pool, feed.id);
    }
  });

  it('reads and updates app_settings', async () => {
    const pool = getPool();

    const before = await getAppSettings(pool);
    try {
      const updated = await updateAppSettings(pool, {
        aiModel: 'gpt-test',
        rssTimeoutMs: before.rssTimeoutMs + 1,
      });
      expect(updated.aiModel).toBe('gpt-test');
      expect(updated.rssTimeoutMs).toBe(before.rssTimeoutMs + 1);
    } finally {
      await updateAppSettings(pool, before);
    }
  });
});
