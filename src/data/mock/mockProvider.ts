import { mockArticles, mockCategories, mockFeeds } from '../../mock/data';
import type { Article, Feed } from '../../types';
import type { ReaderDataProvider, ReaderSnapshot } from '../provider/readerDataProvider';

const uncategorizedName = '未分类';

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

function ensureCategory(categories: ReaderSnapshot['categories'], name: string) {
  if (!categories.some((item) => item.name === name)) {
    categories.push({ id: name, name, expanded: true });
  }
}

export function createMockProvider(): ReaderDataProvider {
  const state: ReaderSnapshot = {
    feeds: mockFeeds.map((feed) => ({ ...feed })),
    categories: mockCategories.map((category) => ({ ...category })),
    articles: mockArticles.map((article) => ({ ...article })),
  };

  const emitSnapshot = (): ReaderSnapshot => cloneSnapshot(state);

  const apply = (mutate: () => void): ReaderSnapshot => {
    mutate();

    ensureCategory(state.categories, uncategorizedName);

    for (const feed of state.feeds) {
      const categoryName = feed.category?.trim();
      if (categoryName) {
        ensureCategory(state.categories, categoryName);
      }
    }

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
          category: feed.category?.trim() || null,
          unreadCount: feed.unreadCount ?? 0,
        });
      });
    },
    toggleCategory(categoryId) {
      return apply(() => {
        const category = state.categories.find((item) => item.id === categoryId || item.name === categoryId);
        if (category) {
          category.expanded = !category.expanded;
        }
      });
    },
  };
}
