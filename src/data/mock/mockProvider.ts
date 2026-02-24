import { mockArticles, mockCategories, mockFeeds } from '../../mock/data';
import type { Article, Category, Feed } from '../../types';
import type { ReaderDataProvider, ReaderSnapshot } from '../provider/readerDataProvider';

const uncategorizedCategory: Category = {
  id: 'cat-uncategorized',
  name: '未分类',
  expanded: true,
};

function cloneSnapshot(snapshot: ReaderSnapshot): ReaderSnapshot {
  return {
    feeds: snapshot.feeds.map((feed) => ({ ...feed })),
    categories: snapshot.categories.map((category) => ({ ...category })),
    articles: snapshot.articles.map((article) => ({ ...article })),
  };
}

function recalculateUnreadCounts(feeds: Feed[], articles: Article[]): Feed[] {
  const unreadByFeed = new Map<string, number>();

  for (const article of articles) {
    if (!article.isRead) {
      unreadByFeed.set(article.feedId, (unreadByFeed.get(article.feedId) ?? 0) + 1);
    }
  }

  return feeds.map((feed) => ({
    ...feed,
    unreadCount: unreadByFeed.get(feed.id) ?? 0,
  }));
}

function normalizeText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function findCategoryById(categories: Category[], id: string): Category | undefined {
  return categories.find((item) => item.id === id);
}

function findCategoryByName(categories: Category[], name: string): Category | undefined {
  return categories.find((item) => item.name === name);
}

function ensureCategory(
  categories: ReaderSnapshot['categories'],
  id: string,
  name: string,
): Category | null {
  const normalizedId = normalizeText(id);
  const normalizedName = normalizeText(name);
  if (!normalizedId || !normalizedName) {
    return null;
  }

  const existingById = findCategoryById(categories, normalizedId);
  if (existingById) {
    return existingById;
  }

  const existingByName = findCategoryByName(categories, normalizedName);
  if (existingByName) {
    return existingByName;
  }

  const created: Category = { id: normalizedId, name: normalizedName, expanded: true };
  categories.push(created);
  return created;
}

function resolveFeedCategory(feed: Feed, categories: Category[]): Pick<Feed, 'categoryId' | 'category'> {
  const normalizedCategoryId = normalizeText(feed.categoryId);
  const normalizedLegacyCategoryName = normalizeText(feed.category);

  if (normalizedCategoryId) {
    const categoryById = findCategoryById(categories, normalizedCategoryId);
    if (categoryById) {
      return { categoryId: categoryById.id, category: categoryById.name };
    }

    const categoryByLegacyName = findCategoryByName(categories, normalizedCategoryId);
    if (categoryByLegacyName) {
      return { categoryId: categoryByLegacyName.id, category: categoryByLegacyName.name };
    }

    return { categoryId: normalizedCategoryId, category: normalizedLegacyCategoryName };
  }

  if (normalizedLegacyCategoryName) {
    const categoryByName =
      findCategoryByName(categories, normalizedLegacyCategoryName) ??
      findCategoryById(categories, normalizedLegacyCategoryName);

    if (categoryByName) {
      return { categoryId: categoryByName.id, category: categoryByName.name };
    }

    const createdCategory = ensureCategory(
      categories,
      normalizedLegacyCategoryName,
      normalizedLegacyCategoryName,
    );
    if (createdCategory) {
      return { categoryId: createdCategory.id, category: createdCategory.name };
    }
  }

  return { categoryId: null, category: null };
}

function normalizeSnapshotCategoriesAndFeeds(snapshot: ReaderSnapshot): void {
  ensureCategory(snapshot.categories, uncategorizedCategory.id, uncategorizedCategory.name);
  snapshot.feeds = snapshot.feeds.map((feed) => ({
    ...feed,
    ...resolveFeedCategory(feed, snapshot.categories),
  }));
}

export function createMockProvider(): ReaderDataProvider {
  const state: ReaderSnapshot = {
    feeds: mockFeeds.map((feed) => ({ ...feed })),
    categories: mockCategories.map((category) => ({ ...category })),
    articles: mockArticles.map((article) => ({ ...article })),
  };

  normalizeSnapshotCategoriesAndFeeds(state);
  state.feeds = recalculateUnreadCounts(state.feeds, state.articles);

  const emitSnapshot = (): ReaderSnapshot => cloneSnapshot(state);

  const apply = (mutate: () => void): ReaderSnapshot => {
    mutate();

    normalizeSnapshotCategoriesAndFeeds(state);
    state.feeds = recalculateUnreadCounts(state.feeds, state.articles);
    return emitSnapshot();
  };

  return {
    getSnapshot() {
      return emitSnapshot();
    },
    markAsRead(articleId) {
      return apply(() => {
        const article = state.articles.find((item) => item.id === articleId);
        if (article) {
          article.isRead = true;
        }
      });
    },
    markAllAsRead(feedId) {
      return apply(() => {
        for (const article of state.articles) {
          if (!feedId || article.feedId === feedId) {
            article.isRead = true;
          }
        }
      });
    },
    toggleStar(articleId) {
      return apply(() => {
        const article = state.articles.find((item) => item.id === articleId);
        if (article) {
          article.isStarred = !article.isStarred;
        }
      });
    },
    addFeed(feed) {
      return apply(() => {
        state.feeds.push({
          ...feed,
          categoryId: normalizeText(feed.categoryId),
          category: normalizeText(feed.category),
          unreadCount: feed.unreadCount ?? 0,
        });
      });
    },
    toggleCategory(categoryId) {
      return apply(() => {
        const normalizedCategoryId = normalizeText(categoryId);
        if (!normalizedCategoryId) {
          return;
        }

        const category =
          findCategoryById(state.categories, normalizedCategoryId) ??
          findCategoryByName(state.categories, normalizedCategoryId);
        if (category) {
          category.expanded = !category.expanded;
        }
      });
    },
  };
}
