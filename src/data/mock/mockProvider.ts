import { mockArticles, mockFeeds, mockFolders } from '../../mock/data';
import type { Article, Feed, Folder } from '../../types';
import type { ReaderDataProvider, ReaderSnapshot } from '../provider/readerDataProvider';

function cloneSnapshot(snapshot: ReaderSnapshot): ReaderSnapshot {
  return {
    feeds: snapshot.feeds.map((feed) => ({ ...feed })),
    folders: snapshot.folders.map((folder) => ({ ...folder })),
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

export function createMockProvider(): ReaderDataProvider {
  const state: ReaderSnapshot = {
    feeds: mockFeeds.map((feed) => ({ ...feed })),
    folders: mockFolders.map((folder) => ({ ...folder })),
    articles: mockArticles.map((article) => ({ ...article })),
  };

  const emitSnapshot = (): ReaderSnapshot => cloneSnapshot(state);

  const apply = (mutate: () => void): ReaderSnapshot => {
    mutate();
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
          unreadCount: feed.unreadCount ?? 0,
        });
      });
    },
    toggleFolder(folderId) {
      return apply(() => {
        const folder = state.folders.find((item) => item.id === folderId);
        if (folder) {
          folder.expanded = !folder.expanded;
        }
      });
    },
  };
}
