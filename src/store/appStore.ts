import { create } from 'zustand';
import type { Article, Category, Feed, ViewType } from '../types';
import { useSettingsStore } from './settingsStore';
import {
  createFeed,
  deleteFeed,
  getArticle,
  getReaderSnapshot,
  mapArticleDto,
  mapFeedDto,
  mapSnapshotArticleItem,
  markAllRead,
  patchFeed,
  patchArticle,
  refreshFeed,
} from '../lib/apiClient';

interface AppState {
  feeds: Feed[];
  categories: Category[];
  articles: Article[];
  selectedView: ViewType;
  selectedArticleId: string | null;
  sidebarCollapsed: boolean;
  showUnreadOnly: boolean;
  snapshotLoading: boolean;

  setSelectedView: (view: ViewType) => void;
  setSelectedArticle: (id: string | null) => void;
  toggleShowUnreadOnly: () => void;
  refreshArticle: (articleId: string) => Promise<{ hasFulltext: boolean }>;
  loadSnapshot: (input?: { view?: ViewType }) => Promise<void>;
  toggleSidebar: () => void;
  markAsRead: (articleId: string) => void;
  markAllAsRead: (feedId?: string) => void;
  addFeed: (feed: { title: string; url: string; categoryId: string | null; fullTextOnOpenEnabled?: boolean }) => void;
  updateFeed: (feedId: string, patch: { title?: string; enabled?: boolean; categoryId?: string | null; fullTextOnOpenEnabled?: boolean }) => Promise<void>;
  removeFeed: (feedId: string) => Promise<void>;
  toggleStar: (articleId: string) => void;
  toggleCategory: (categoryId: string) => void;
  clearCategoryFromFeeds: (categoryId: string) => void;
}

const uncategorizedCategory: Category = {
  id: 'cat-uncategorized',
  name: '未分类',
  expanded: true,
};

function normalizeText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function ensureUncategorizedCategory(categories: Category[], expandedById: Map<string, boolean>) {
  const existing = categories.find((item) => item.id === uncategorizedCategory.id);
  if (existing) return;

  categories.push({
    ...uncategorizedCategory,
    expanded: expandedById.get(uncategorizedCategory.id) ?? true,
  });
}

function findCategoryById(categories: Category[], id: string): Category | undefined {
  return categories.find((item) => item.id === id);
}

function findCategoryByName(categories: Category[], name: string): Category | undefined {
  return categories.find((item) => item.name === name);
}

function findCategoryByNameCaseInsensitive(categories: Category[], name: string): Category | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return categories.find((item) => item.name.trim().toLowerCase() === key);
}

function resolveCategoryTarget(categories: Category[], input: string): Category | undefined {
  const normalized = normalizeText(input);
  if (!normalized) return undefined;

  return (
    findCategoryById(categories, normalized) ??
    findCategoryByName(categories, normalized) ??
    findCategoryByNameCaseInsensitive(categories, normalized)
  );
}

let snapshotRequestId = 0;

export const useAppStore = create<AppState>((set, get) => ({
  feeds: [],
  categories: [uncategorizedCategory],
  articles: [],
  selectedView: 'all',
  selectedArticleId: null,
  sidebarCollapsed: false,
  showUnreadOnly: false,
  snapshotLoading: false,

  setSelectedView: (view) =>
    set(() => {
      const defaultUnreadOnlyInAll = useSettingsStore.getState().persistedSettings.general.defaultUnreadOnlyInAll;
      const showUnreadOnly = view !== 'unread' && view !== 'starred' ? defaultUnreadOnlyInAll : false;
      return { selectedView: view, selectedArticleId: null, showUnreadOnly };
    }),
  setSelectedArticle: (id) => {
    set({ selectedArticleId: id });

    if (!id) return;
    const article = get().articles.find((item) => item.id === id);
    if (article?.content) return;

    void (async () => {
      try {
        const dto = await getArticle(id);
        const mapped = mapArticleDto(dto);
        set((state) => {
          const existing = state.articles.find((item) => item.id === mapped.id);
          if (existing) {
            return {
              articles: state.articles.map((item) =>
                item.id === mapped.id ? { ...item, ...mapped } : item
              ),
            };
          }
          return { articles: [mapped, ...state.articles] };
        });
      } catch (err) {
        console.error(err);
      }
    })();
  },
  toggleShowUnreadOnly: () => set((state) => ({ showUnreadOnly: !state.showUnreadOnly })),
  refreshArticle: async (articleId) => {
    try {
      const dto = await getArticle(articleId);
      const hasFulltext = Boolean(dto.contentFullHtml);
      const mapped = mapArticleDto(dto);
      set((state) => {
        const existing = state.articles.find((item) => item.id === mapped.id);
        if (existing) {
          return {
            articles: state.articles.map((item) =>
              item.id === mapped.id ? { ...item, ...mapped } : item
            ),
          };
        }
        return { articles: [mapped, ...state.articles] };
      });
      return { hasFulltext };
    } catch (err) {
      console.error(err);
      return { hasFulltext: false };
    }
  },
  loadSnapshot: async (input) => {
    const requestId = snapshotRequestId + 1;
    snapshotRequestId = requestId;
    set({ snapshotLoading: true });

    try {
      const view = input?.view ?? get().selectedView;
      const snapshot = await getReaderSnapshot({ view });

      if (requestId !== snapshotRequestId) return;

      set((state) => {
        const expandedById = new Map(
          state.categories.map((category) => [category.id, category.expanded ?? true]),
        );

        const categories: Category[] = snapshot.categories.map((item) => ({
          id: item.id,
          name: item.name,
          expanded: expandedById.get(item.id) ?? true,
        }));
        ensureUncategorizedCategory(categories, expandedById);

        const feeds = snapshot.feeds.map((feed) => mapFeedDto(feed, categories));
        const articles = snapshot.articles.items.map(mapSnapshotArticleItem);

        return {
          categories,
          feeds,
          articles,
          snapshotLoading: false,
        };
      });
    } catch (err) {
      console.error(err);
      if (requestId === snapshotRequestId) {
        set({ snapshotLoading: false });
      }
    }
  },
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  markAsRead: (articleId) => {
    const article = get().articles.find((item) => item.id === articleId);
    if (!article || article.isRead) return;

    set((state) => ({
      articles: state.articles.map((item) =>
        item.id === articleId ? { ...item, isRead: true } : item,
      ),
      feeds: state.feeds.map((feed) =>
        feed.id === article.feedId
          ? { ...feed, unreadCount: Math.max(0, feed.unreadCount - 1) }
          : feed,
      ),
    }));

    void patchArticle(articleId, { isRead: true }).catch((err) => console.error(err));
  },

  markAllAsRead: (feedId) => {
    set((state) => ({
      articles: state.articles.map((item) => {
        if (feedId && item.feedId !== feedId) return item;
        return item.isRead ? item : { ...item, isRead: true };
      }),
      feeds: state.feeds.map((feed) => {
        if (!feedId || feed.id === feedId) {
          return { ...feed, unreadCount: 0 };
        }
        return feed;
      }),
    }));

    void markAllRead(feedId ? { feedId } : {}).catch((err) => console.error(err));
  },

  addFeed: (payload) => {
    void (async () => {
      try {
        const created = await createFeed(payload);
        const categories = get().categories;
        const mapped = mapFeedDto(created, categories);

        set((state) => ({
          feeds: state.feeds.some((item) => item.id === mapped.id)
            ? state.feeds
            : [...state.feeds, mapped],
          selectedView: mapped.id,
          selectedArticleId: null,
        }));

        void refreshFeed(created.id).catch((err) => console.error(err));
      } catch (err) {
        console.error(err);
      }
    })();
  },

  updateFeed: async (feedId, patch) => {
    const updated = await patchFeed(feedId, patch);
    set((state) => {
      const categoryNameById = new Map(state.categories.map((category) => [category.id, category.name]));

      return {
        feeds: state.feeds.map((feed) => {
          if (feed.id !== feedId) return feed;

          return {
            ...feed,
            title: updated.title,
            enabled: updated.enabled,
            fullTextOnOpenEnabled: updated.fullTextOnOpenEnabled,
            categoryId: updated.categoryId,
            category: updated.categoryId ? (categoryNameById.get(updated.categoryId) ?? null) : null,
          };
        }),
      };
    });
  },

  removeFeed: async (feedId) => {
    await deleteFeed(feedId);

    set((state) => {
      const nextSelectedView = state.selectedView === feedId ? 'all' : state.selectedView;
      const nextSelectedArticleId = state.selectedView === feedId ? null : state.selectedArticleId;

      return {
        feeds: state.feeds.filter((feed) => feed.id !== feedId),
        articles: state.articles.filter((article) => article.feedId !== feedId),
        selectedView: nextSelectedView,
        selectedArticleId: nextSelectedArticleId,
      };
    });
  },

  toggleStar: (articleId) => {
    const article = get().articles.find((item) => item.id === articleId);
    if (!article) return;
    const nextValue = !article.isStarred;

    set((state) => ({
      articles: state.articles.map((item) =>
        item.id === articleId ? { ...item, isStarred: nextValue } : item,
      ),
    }));

    void patchArticle(articleId, { isStarred: nextValue }).catch((err) => console.error(err));
  },

  toggleCategory: (categoryId) =>
    set((state) => {
      const category = resolveCategoryTarget(state.categories, categoryId);
      if (!category) return {};

      return {
        categories: state.categories.map((item) =>
          item.id === category.id ? { ...item, expanded: !(item.expanded ?? true) } : item,
        ),
      };
    }),

  clearCategoryFromFeeds: (categoryId) =>
    set((state) => ({
      feeds: state.feeds.map((feed) =>
        feed.categoryId === categoryId
          ? {
              ...feed,
              categoryId: null,
              category: null,
            }
          : feed
      ),
    })),
}));
